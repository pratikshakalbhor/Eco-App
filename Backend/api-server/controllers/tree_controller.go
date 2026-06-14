package controllers

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func RegisterTree(c *gin.Context) {
	var input struct {
		Species           string  `json:"species" binding:"required"`
		Nickname          string  `json:"nickname"`
		Latitude          float64 `json:"latitude"`
		Longitude         float64 `json:"longitude"`
		Location          string  `json:"location"`
		PhotoURL          string  `json:"image_url"`
		IPFSHash          string  `json:"ipfs_hash"`
		PlantedAt         string  `json:"planting_date"`
		Age               int     `json:"age"`
		HealthStatus      string  `json:"health_status"`
		BlockchainTokenID string  `json:"blockchain_token_id"`
		TransactionHash   string  `json:"transaction_hash"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDString, _ := c.Get("userID")
	userID, _ := uuid.Parse(userIDString.(string))

	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	rate := 18.5 // Default
	if r, ok := AbsorptionRates[input.Species]; ok {
		rate = r
	}

	plantedAt := time.Now()
	if input.PlantedAt != "" {
		if t, err := time.Parse("2006-01-02", input.PlantedAt); err == nil {
			plantedAt = t
		}
	}

	// Format: TREE-{timestamp}-{random4}
	timestamp := time.Now().Unix()
	randSuffix := uuid.New().String()[:4]
	treeID := fmt.Sprintf("TREE-%d-%s", timestamp, randSuffix)

	tree := models.Tree{
		ID:                uuid.New(),
		TreeID:            treeID,
		PlanterID:         userID,
		Species:           input.Species,
		Nickname:          input.Nickname,
		OwnerWallet:       user.WalletAddress,
		Latitude:          input.Latitude,
		Longitude:         input.Longitude,
		Location:          input.Location,
		PhotoURL:          input.PhotoURL,
		IPFSHash:          input.IPFSHash,
		BlockchainTokenID: input.BlockchainTokenID,
		TransactionHash:   input.TransactionHash,
		Status:            "PENDING_VERIFICATION",
		HealthStatus:      input.HealthStatus,
		CarbonAbsorptionRate: rate,
		PlantedAt:         plantedAt,
		Age:               input.Age,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := config.DB.Create(&tree).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register tree"})
		return
	}

	LogActivity("TREE_PLANTED", tree.TreeID, nil, user.WalletAddress, fmt.Sprintf("Planted a new %s tree at %s", tree.Species, tree.Location))

	c.JSON(http.StatusOK, gin.H{"message": "Tree successfully registered", "tree": tree})
}

func GetAllTrees(c *gin.Context) {
	var trees []models.Tree
	if err := config.DB.Preload("Planter").Preload("CutReport").Preload("Verifications").Find(&trees).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch trees"})
		return
	}
	c.JSON(http.StatusOK, trees)
}

func VerifyTree(c *gin.Context) {
	treeID := c.Param("id")
	var input struct {
		Status string `json:"status" binding:"required"` // VERIFIED or REJECTED
		Notes  string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var tree models.Tree
	if err := config.DB.First(&tree, "id = ?", treeID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tree not found"})
		return
	}

	verifierIDString, _ := c.Get("userID")
	verifierID, _ := uuid.Parse(verifierIDString.(string))

	now := time.Now()
	// Map status to uppercase as per requirements
	status := "PENDING_VERIFICATION"
	if input.Status == "approve" || input.Status == "VERIFIED" {
		status = "VERIFIED"
	} else if input.Status == "reject" || input.Status == "REJECTED" {
		status = "REJECTED"
	}

	tree.Status = status
	tree.VerifiedAt = &now
	tree.VerifiedBy = &verifierID
	tree.UpdatedAt = now

	tx := config.DB.Begin()
	if err := tx.Save(&tree).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update tree status"})
		return
	}

	verification := models.Verification{
		ID:          uuid.New(),
		TreeID:      tree.ID,
		VerifierID:  verifierID,
		Status:      status,
		Notes:       input.Notes,
		CreatedAt:   time.Now(),
	}

	if err := tx.Create(&verification).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record verification"})
		return
	}

	if status == "VERIFIED" {
		// 1. Update User XP
		tx.Model(&models.User{}).Where("id = ?", tree.PlanterID).Update("xp_points", gorm.Expr("xp_points + ?", 100))

		// 2. Mint Carbon Credits (Internal Record)
		credit := models.CarbonCredit{
			ID:        uuid.New(),
			UserID:    tree.PlanterID,
			TreeID:    tree.ID,
			Amount:    1.0, 
			Type:      "verification_reward",
			CreatedAt: time.Now(),
		}
		tx.Create(&credit)

		LogActivity("TREE_VERIFIED", tree.TreeID, nil, "", fmt.Sprintf("Tree %s verified by administrator", tree.TreeID))

		// Check if this tree is a replacement for a debt
		if tree.IsReplacement && tree.ReplantedDebtID != nil {
			var debt models.ReplantationDebt
			if err := tx.First(&debt, "id = ?", tree.ReplantedDebtID).Error; err == nil {
				// Recalculate verified count
				var verifiedCount int64
				tx.Model(&models.ReplacementTree{}).
					Joins("JOIN trees ON trees.tree_id = replacement_trees.tree_id").
					Where("replacement_trees.debt_id = ? AND trees.status = ?", debt.ID, "VERIFIED").
					Count(&verifiedCount)

				updates := map[string]interface{}{
					"trees_verified": int(verifiedCount),
					"updated_at":     time.Now(),
				}

				if int(verifiedCount) >= debt.TreesNeeded {
					updates["status"] = "CLEARED"
					now := time.Now()
					updates["cleared_at"] = &now
					
					// Unfreeze credits
					tx.Model(&models.CarbonCredit{}).
						Where("tree_id = (SELECT id FROM trees WHERE tree_id = ?)", debt.OriginalTreeID).
						Update("tradeable", true)
						
					// Log Debt Clear
					LogActivity("DEBT_CLEARED", debt.OriginalTreeID, &debt.ID, debt.OwnerWallet, "Replantation debt cleared automatically after tree verification")
				}

				tx.Model(&debt).Updates(updates)
			}
		}
	}

	tx.Commit()

	// Trigger NFT mint log for future implementation
	log.Printf("NFT_PENDING: Tree %s verified. Minting process initiated by %s", tree.TreeID, verifierID)

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Tree %s verified successfully", tree.TreeID), "tree": tree})
}

func GetTreeByID(c *gin.Context) {
	treeID := c.Param("id")
	var tree models.Tree
	if err := config.DB.Preload("Planter").Preload("CutReport").Preload("Verifications").First(&tree, "id = ?", treeID).Error; err != nil {
		// Try searching by tree_id string if UUID fails
		if errSearch := config.DB.Preload("Planter").Preload("CutReport").Preload("Verifications").First(&tree, "tree_id = ?", treeID).Error; errSearch != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Tree not found"})
			return
		}
	}
	c.JSON(http.StatusOK, tree)
}

func GetMyTrees(c *gin.Context) {
	userIDString, _ := c.Get("userID")
	userID, _ := uuid.Parse(userIDString.(string))

	var trees []models.Tree
	if err := config.DB.Preload("CutReport").Where("planter_id = ?", userID).Find(&trees).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch trees"})
		return
	}

	c.JSON(http.StatusOK, trees)
}

func GetPendingTrees(c *gin.Context) {
	var trees []models.Tree
	if err := config.DB.Preload("Planter").Where("status = ?", "PENDING_VERIFICATION").Find(&trees).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch pending trees"})
		return
	}

	c.JSON(http.StatusOK, trees)
}

func GetTreeStats(c *gin.Context) {
	var total, pending, verified, rejected, cutReported, cutConfirmed, debtsActive, debtsCleared int64

	config.DB.Model(&models.Tree{}).Count(&total)
	config.DB.Model(&models.Tree{}).Where("status = ?", "PENDING_VERIFICATION").Count(&pending)
	config.DB.Model(&models.Tree{}).Where("status = ?", "VERIFIED").Count(&verified)
	config.DB.Model(&models.Tree{}).Where("status = ?", "REJECTED").Count(&rejected)
	config.DB.Model(&models.Tree{}).Where("status = ?", "CUT_REPORTED").Count(&cutReported)
	config.DB.Model(&models.Tree{}).Where("status = ?", "CUT_CONFIRMED").Count(&cutConfirmed)
	config.DB.Model(&models.ReplantationDebt{}).Where("status != ?", "CLEARED").Count(&debtsActive)
	config.DB.Model(&models.ReplantationDebt{}).Where("status = ?", "CLEARED").Count(&debtsCleared)

	c.JSON(http.StatusOK, gin.H{
		"total":           total,
		"pending":         pending,
		"verified":        verified,
		"rejected":        rejected,
		"cut_reported":    cutReported,
		"cut_confirmed":   cutConfirmed,
		"debts_active":    debtsActive,
		"debts_cleared":   debtsCleared,
	})
}
