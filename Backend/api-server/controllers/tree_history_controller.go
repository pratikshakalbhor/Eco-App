package controllers

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetTreeHistory — GET /api/trees/:id/history
// Returns a combined timeline of all events for a tree: registration, verification, cuts, debt clearance.
func GetTreeHistory(c *gin.Context) {
	treeID := c.Param("id")

	type TimelineEvent struct {
		EventType   string `json:"event_type"`
		Description string `json:"description"`
		Actor       string `json:"actor"`
		TxHash      string `json:"tx_hash,omitempty"`
		At          string `json:"at"`
	}

	events := make([]TimelineEvent, 0)

	// 1. Get tree for registration event
	var tree models.Tree
	if err := config.DB.First(&tree, "id = ? OR tree_id = ?", treeID, treeID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tree not found"})
		return
	}

	events = append(events, TimelineEvent{
		EventType:   "TREE_REGISTERED",
		Description: fmt.Sprintf("%s tree registered and NFT minted", tree.Species),
		Actor:       tree.OwnerWallet,
		TxHash:      tree.TransactionHash,
		At:          tree.CreatedAt.Format("2006-01-02T15:04:05Z"),
	})

	// 2. Verifications
	var verifications []models.Verification
	config.DB.Where("tree_id = ?", tree.ID).Order("created_at asc").Find(&verifications)
	for _, v := range verifications {
		status := "VERIFIED"
		if v.Status == "REJECTED" {
			status = "REJECTED"
		}
		events = append(events, TimelineEvent{
			EventType:   status,
			Description: fmt.Sprintf("Tree %s by verifier — %s", v.Status, v.Notes),
			Actor:       v.VerifierID.String(),
			At:          v.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	// 3. Cut report
	var cutReport models.CutReport
	if err := config.DB.Where("tree_id = ?", tree.TreeID).First(&cutReport).Error; err == nil {
		events = append(events, TimelineEvent{
			EventType:   "CUT_REPORTED",
			Description: fmt.Sprintf("Tree cutting reported — Reason: %s", cutReport.Reason),
			Actor:       cutReport.OwnerWallet,
			At:          cutReport.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
		if cutReport.Status == "CONFIRMED" {
			confirmedAt := cutReport.CreatedAt // fallback
			if cutReport.ConfirmedAt != nil {
				confirmedAt = *cutReport.ConfirmedAt
			}
			events = append(events, TimelineEvent{
				EventType:   "CUT_CONFIRMED",
				Description: "Cut confirmed by verifier. Environmental debt created.",
				Actor:       cutReport.ConfirmedBy,
				At:          confirmedAt.Format("2006-01-02T15:04:05Z"),
			})
		}
	}

	// 4. Activity logs for this tree
	var actLogs []models.ActivityLog
	config.DB.Where("tree_id = ?", tree.TreeID).Order("created_at asc").Find(&actLogs)
	for _, log := range actLogs {
		// Skip TREE_PLANTED since we already have TREE_REGISTERED
		if log.EventType == "TREE_PLANTED" {
			continue
		}
		events = append(events, TimelineEvent{
			EventType:   log.EventType,
			Description: log.Description,
			Actor:       log.Actor,
			At:          log.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"tree_id":   tree.TreeID,
		"species":   tree.Species,
		"status":    tree.Status,
		"token_id":  tree.BlockchainTokenID,
		"tx_hash":   tree.TransactionHash,
		"ipfs_hash": tree.IPFSHash,
		"events":    events,
	})
}

// GetTreeAllPublic — GET /api/trees/all
// Returns all trees with coordinates for the Map (public - no auth required).
func GetTreeAllPublic(c *gin.Context) {
	var trees []models.Tree
	status := c.Query("status")
	species := c.Query("species")

	query := config.DB.Select("id, tree_id, species, status, health_status, latitude, longitude, location, image_url, ipfs_hash, owner_wallet, blockchain_token_id, carbon_absorption_rate, planting_date, is_replacement, created_at")

	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	if species != "" {
		query = query.Where("species LIKE ?", "%"+species+"%")
	}

	query.Find(&trees)
	c.JSON(http.StatusOK, trees)
}

// UpdateTreeGrowth — PATCH /api/trees/:id/growth
// Allows the tree owner to update health status and notes.
func UpdateTreeGrowth(c *gin.Context) {
	treeID := c.Param("id")
	userIDString, _ := c.Get("userID")
	userID, _ := uuid.Parse(userIDString.(string))

	var tree models.Tree
	if err := config.DB.First(&tree, "id = ?", treeID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tree not found"})
		return
	}

	if tree.PlanterID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only update your own trees"})
		return
	}

	if tree.Status != "VERIFIED" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only verified trees can have growth updates"})
		return
	}

	var req struct {
		HealthStatus string  `json:"health_status"`
		Notes        string  `json:"notes"`
		ImageURL     string  `json:"image_url"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.HealthStatus != "" {
		updates["health_status"] = req.HealthStatus
	}
	if req.ImageURL != "" {
		updates["image_url"] = req.ImageURL
	}

	config.DB.Model(&tree).Updates(updates)

	// Log activity
	walletRaw, _ := c.Get("walletAddress")
	LogActivity("GROWTH_UPDATE", tree.TreeID, nil, fmt.Sprintf("%v", walletRaw),
		fmt.Sprintf("%s tree health updated to %s", tree.Species, req.HealthStatus))

	c.JSON(http.StatusOK, gin.H{"message": "Tree growth updated", "tree": tree})
}

// GetNotifications — GET /api/notifications
// Returns recent activity logs relevant to the current user.
func GetNotifications(c *gin.Context) {
	walletRaw, _ := c.Get("walletAddress")
	wallet := fmt.Sprintf("%v", walletRaw)

	// Get recent activity for trees this user owns
	var logs []models.ActivityLog
	config.DB.
		Where("actor = ?", wallet).
		Order("created_at desc").
		Limit(20).
		Find(&logs)

	c.JSON(http.StatusOK, logs)
}

// GetAdminStats — GET /api/admin/stats
// Returns comprehensive admin dashboard metrics.
func GetAdminStats(c *gin.Context) {
	var stats struct {
		TotalUsers        int64   `json:"total_users"`
		TotalTrees        int64   `json:"total_trees"`
		PendingTrees      int64   `json:"pending_trees"`
		VerifiedTrees     int64   `json:"verified_trees"`
		RejectedTrees     int64   `json:"rejected_trees"`
		CutTrees          int64   `json:"cut_trees"`
		ActiveDebts       int64   `json:"active_debts"`
		ClearedDebts      int64   `json:"cleared_debts"`
		TotalCredits      float64 `json:"total_credits"`
		TotalMarketVol    float64 `json:"total_market_volume"`
		PendingCutReports int64   `json:"pending_cut_reports"`
	}

	config.DB.Model(&models.User{}).Count(&stats.TotalUsers)
	config.DB.Model(&models.Tree{}).Count(&stats.TotalTrees)
	config.DB.Model(&models.Tree{}).Where("status = ?", "PENDING_VERIFICATION").Count(&stats.PendingTrees)
	config.DB.Model(&models.Tree{}).Where("status = ?", "VERIFIED").Count(&stats.VerifiedTrees)
	config.DB.Model(&models.Tree{}).Where("status = ?", "REJECTED").Count(&stats.RejectedTrees)
	config.DB.Model(&models.Tree{}).Where("status IN ?", []string{"CUT_REPORTED", "CUT_CONFIRMED"}).Count(&stats.CutTrees)
	config.DB.Model(&models.ReplantationDebt{}).Where("status != ?", "CLEARED").Count(&stats.ActiveDebts)
	config.DB.Model(&models.ReplantationDebt{}).Where("status = ?", "CLEARED").Count(&stats.ClearedDebts)
	config.DB.Model(&models.CarbonCredit{}).Where("amount > 0").Select("COALESCE(SUM(amount), 0)").Scan(&stats.TotalCredits)
	config.DB.Model(&models.MarketplaceTransaction{}).Where("status = ?", "CONFIRMED").Select("COALESCE(SUM(total_price), 0)").Scan(&stats.TotalMarketVol)
	config.DB.Model(&models.CutReport{}).Where("status = ?", "PENDING").Count(&stats.PendingCutReports)

	c.JSON(http.StatusOK, stats)
}

// GetAllUsers — GET /api/admin/users
func GetAllUsers(c *gin.Context) {
	var users []models.User
	config.DB.Select("id, wallet_address, full_name, role, xp_points, created_at").Find(&users)
	c.JSON(http.StatusOK, users)
}
