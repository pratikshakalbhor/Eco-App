package controllers

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"ecochain-backend/services"
	"fmt"
	"log"
	"math"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// MaxCutReportAccuracyMeters is the maximum acceptable horizontal accuracy
// of the GPS reading that accompanies a cut report.
//
// navigator.geolocation reports the radius of uncertainty of its fix. A
// reading with a 500 m accuracy says nothing about whether the reporter was
// standing next to the tree, so the 100 m geofence check would be
// meaningless. Reports that cannot prove a precise position are rejected.
const MaxCutReportAccuracyMeters = 25.0

// ReportCut — POST /api/trees/:id/report-cut
// The tree owner reports that one of their VERIFIED trees has been cut.
func ReportCut(c *gin.Context) {
	treeID := c.Param("id")

	var input struct {
		Reason           string  `json:"reason" binding:"required"`
		CutDate          string  `json:"cut_date" binding:"required"` // YYYY-MM-DD
		Description      string  `json:"description"`
		EvidenceImageURL string  `json:"evidence_image_url"`
		Latitude         float64 `json:"latitude" binding:"required"`
		Longitude        float64 `json:"longitude" binding:"required"`
		// Accuracy is the horizontal accuracy of the GPS fix in metres, as
		// reported by navigator.geolocation (position.coords.accuracy).
		Accuracy float64 `json:"accuracy"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// The geofence check below is only meaningful if the device could fix its
	// position precisely. A missing or imprecise reading is rejected.
	if input.Accuracy <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "A GPS reading with an accuracy of at most 25 metres is required to report a cut. Please allow location access and try again.",
		})
		return
	}
	if input.Accuracy > MaxCutReportAccuracyMeters {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Your GPS reading is only accurate to %.0f m. A reading of %.0f m or better is required to report a cut.",
				input.Accuracy, MaxCutReportAccuracyMeters),
		})
		return
	}

	// Only the owner of the tree may report it as cut. Without this check any
	// authenticated user could freeze an arbitrary tree's credits and cancel
	// its marketplace listings.
	walletRaw, exists := c.Get("walletAddress")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Wallet address not found in context"})
		return
	}
	ownerWallet := fmt.Sprintf("%v", walletRaw)

	var tree models.Tree
	if err := config.DB.First(&tree, "tree_id = ? AND LOWER(owner_wallet) = LOWER(?)", treeID, ownerWallet).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tree not found"})
		return
	}

	// GPS Validation - 100m radius
	dist := calculateDistance(input.Latitude, input.Longitude, tree.Latitude, tree.Longitude)
	if dist > 100 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":    fmt.Sprintf("GPS verification failed. Your location is %.1fm away from the original tree record. You must be at the physical location to report a cut.", dist),
			"distance": dist,
		})
		return
	}

	if tree.Status != "VERIFIED" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only VERIFIED trees can be reported as cut"})
		return
	}

	// Parse cut date
	cutDate, err := time.Parse("2006-01-02", input.CutDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid cut_date format, use YYYY-MM-DD"})
		return
	}
	if cutDate.After(time.Now()) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cut date cannot be in the future"})
		return
	}

	tx := config.DB.Begin()

	// 1. Create cut report
	report := models.CutReport{
		ID:               uuid.New(),
		TreeID:           treeID,
		OwnerWallet:      tree.OwnerWallet,
		Reason:           input.Reason,
		CutDate:          cutDate,
		Description:      input.Description,
		EvidenceImageURL: input.EvidenceImageURL,
		Status:           "PENDING",
		CreatedAt:        time.Now(),
	}

	if err := tx.Create(&report).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create cut report"})
		return
	}

	// 2. Update tree status to CUT_REPORTED
	if err := tx.Model(&tree).Update("status", "CUT_REPORTED").Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update tree status"})
		return
	}

	// 3. Freeze carbon credits for this tree
	if err := tx.Model(&models.CarbonCredit{}).
		Where("tree_id = ?", tree.ID).
		Update("tradeable", false).Error; err != nil {
		log.Printf("Warning: Failed to freeze credits for tree %s: %v", treeID, err)
	}

	// 4. Cancel any active marketplace listings
	if err := tx.Model(&models.MarketplaceListing{}).
		Where("tree_id = ? AND status IN ?", treeID, []string{"ACTIVE", "PARTIAL"}).
		Update("status", "CANCELLED").Error; err != nil {
		log.Printf("Warning: Failed to cancel listings for tree %s: %v", treeID, err)
	}

	tx.Commit()
	LogActivity("CUT_REPORTED", tree.TreeID, nil, tree.OwnerWallet, fmt.Sprintf("User reported a cut event for %s tree", tree.Species))

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Tree cut reported. Awaiting admin confirmation. Report ID: %s", report.ID),
		"report":  report,
	})
}

// GetCutReports — GET /api/trees/cut-reports
// Admin fetches all cut reports with optional status filter.
func GetCutReports(c *gin.Context) {
	statusFilter := c.Query("status") // PENDING, CONFIRMED, REJECTED

	var reports []models.CutReport
	query := config.DB

	if statusFilter != "" {
		query = query.Where("status = ?", statusFilter)
	}

	if err := query.Order("created_at desc").Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch cut reports"})
		return
	}

	treeIDSet := make(map[string]bool)
	for _, r := range reports {
		treeIDSet[r.TreeID] = true
	}
	treeIDs := make([]string, 0, len(treeIDSet))
	for id := range treeIDSet {
		treeIDs = append(treeIDs, id)
	}

	treeMap := make(map[string]models.Tree)
	if len(treeIDs) > 0 {
		var trees []models.Tree
		config.DB.Where("tree_id IN ?", treeIDs).Find(&trees)
		for _, t := range trees {
			treeMap[t.TreeID] = t
		}
	}

	type CutReportResponse struct {
		models.CutReport
		Tree *models.Tree `json:"tree"`
	}
	results := make([]CutReportResponse, len(reports))
	for i, r := range reports {
		results[i].CutReport = r
		if t, ok := treeMap[r.TreeID]; ok {
			results[i].Tree = &t
		}
	}

	c.JSON(http.StatusOK, results)
}

// ConfirmCut — POST /api/trees/:id/cut/confirm
// Admin confirms that a tree was actually cut.
// This calculates environmental loss and creates replantation debt.
func ConfirmCut(c *gin.Context) {
	treeID := c.Param("id")

	var tree models.Tree
	if err := config.DB.First(&tree, "tree_id = ?", treeID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tree not found"})
		return
	}

	if tree.Status != "CUT_REPORTED" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tree must be in CUT_REPORTED status"})
		return
	}

	// Find the pending cut report
	var report models.CutReport
	if err := config.DB.Where("tree_id = ? AND status = ?", treeID, "PENDING").
		Order("created_at desc").First(&report).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No pending cut report found for this tree"})
		return
	}

	adminWallet := ""
	if w, ok := c.Get("walletAddress"); ok {
		adminWallet = fmt.Sprintf("%v", w)
	}

	now := time.Now()
	tx := config.DB.Begin()

	// 1. Update report status
	report.Status = "CONFIRMED"
	report.ConfirmedBy = adminWallet
	report.ConfirmedAt = &now
	if err := tx.Save(&report).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update cut report"})
		return
	}

	// 2. Update tree status
	if err := tx.Model(&tree).Update("status", "CUT_CONFIRMED").Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update tree status"})
		return
	}

	// 3. Calculate environmental loss using the shared accounting model so that
	//    the backend, the frontend and the on-chain replantation debt agree.
	impact := services.CalculateEnvironmentalLoss(tree)
	co2Lost := impact.CarbonLoss
	replacementNeeded := impact.RequiredTrees

	// Count total credits actually issued for this tree (authoritative ledger).
	var totalCredits struct{ Total float64 }
	config.DB.Model(&models.CarbonCredit{}).
		Select("COALESCE(SUM(amount), 0) as total").
		Where("tree_id = ? AND amount > 0", tree.ID).
		Scan(&totalCredits)
	creditsLost := totalCredits.Total

	loss := models.EnvironmentalLoss{
		ID:                     uuid.New(),
		TreeID:                 treeID,
		CutReportID:            report.ID,
		CO2LostKg:              co2Lost,
		OxygenLostKg:           impact.OxygenLoss,
		CreditsLost:            creditsLost,
		ReplacementTreesNeeded: replacementNeeded,
		CalculatedAt:           now,
	}

	if err := tx.Create(&loss).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record environmental loss"})
		return
	}

	// 4. Create replantation debt
	debt := models.ReplantationDebt{
		ID:             uuid.New(),
		OriginalTreeID: treeID,
		OwnerWallet:    tree.OwnerWallet,
		TreesNeeded:    replacementNeeded,
		Status:         "PENDING",
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := tx.Create(&debt).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create replantation debt"})
		return
	}

	tx.Commit()
	LogActivity("CUT_CONFIRMED", tree.TreeID, &debt.ID, tree.OwnerWallet, fmt.Sprintf("Admin confirmed cut for %s tree. Environmental loss recorded.", tree.Species))

	log.Printf("CUT_CONFIRMED: Tree %s | CO2 Lost: %.2f kg | Replacement needed: %d trees | Debt ID: %s",
		treeID, co2Lost, replacementNeeded, debt.ID)

	c.JSON(http.StatusOK, gin.H{
		"message":            fmt.Sprintf("Tree %s cut confirmed. Replantation debt created.", treeID),
		"environmental_loss": loss,
		"replantation_debt":  debt,
	})
}

// RejectCut — POST /api/trees/:id/cut/reject
// Admin rejects a cut report — tree reverts to VERIFIED.
func RejectCut(c *gin.Context) {
	treeID := c.Param("id")

	var tree models.Tree
	if err := config.DB.First(&tree, "tree_id = ?", treeID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tree not found"})
		return
	}

	var report models.CutReport
	if err := config.DB.Where("tree_id = ? AND status = ?", treeID, "PENDING").
		Order("created_at desc").First(&report).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No pending cut report found"})
		return
	}

	tx := config.DB.Begin()

	// 1. Reject the report
	if err := tx.Model(&report).Update("status", "REJECTED").Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reject report"})
		return
	}

	// 2. Restore tree to VERIFIED
	if err := tx.Model(&tree).Update("status", "VERIFIED").Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore tree status"})
		return
	}

	// 3. Unfreeze carbon credits
	if err := tx.Model(&models.CarbonCredit{}).
		Where("tree_id = ?", tree.ID).
		Update("tradeable", true).Error; err != nil {
		log.Printf("Warning: Failed to unfreeze credits for tree %s: %v", treeID, err)
	}

	tx.Commit()
	LogActivity("CUT_REJECTED", tree.TreeID, nil, tree.OwnerWallet, fmt.Sprintf("Admin rejected cut report for %s tree. Integrity restored.", tree.Species))

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Cut report rejected. Tree %s restored to VERIFIED status.", treeID),
	})
}

// GetEnvironmentalLoss — GET /api/trees/:id/loss
// Returns the calculated environmental loss for a cut-confirmed tree.
func GetEnvironmentalLoss(c *gin.Context) {
	treeID := c.Param("id")

	var loss models.EnvironmentalLoss
	if err := config.DB.Where("tree_id = ?", treeID).First(&loss).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No environmental loss record found"})
		return
	}

	c.JSON(http.StatusOK, loss)
}

// calculateDistance returns distance in meters between two coordinates
func calculateDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371000 // Earth radius in meters
	phi1 := lat1 * math.Pi / 180
	phi2 := lat2 * math.Pi / 180
	deltaPhi := (lat2 - lat1) * math.Pi / 180
	deltaLambda := (lon2 - lon1) * math.Pi / 180

	a := math.Sin(deltaPhi/2)*math.Sin(deltaPhi/2) +
		math.Cos(phi1)*math.Cos(phi2)*
			math.Sin(deltaLambda/2)*math.Sin(deltaLambda/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return R * c
}
