package controllers

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"net/http"
	"time"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func RegisterTree(c *gin.Context) {
	var input struct {
		Species      string  `json:"species" binding:"required"`
		Latitude     float64 `json:"latitude" binding:"required"`
		Longitude    float64 `json:"longitude" binding:"required"`
		LocationName string  `json:"location_name"`
		PhotoURL     string  `json:"photo_url"`
		IPFSHash          string  `json:"ipfs_hash"`
		BlockchainTokenID string  `json:"blockchain_token_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDString, _ := c.Get("userID")
	userID, _ := uuid.Parse(userIDString.(string))

	tree := models.Tree{
		ID:           uuid.New(),
		PlanterID:    userID,
		Species:      input.Species,
		Latitude:     input.Latitude,
		Longitude:    input.Longitude,
		LocationName: input.LocationName,
		PhotoURL:     input.PhotoURL,
		IPFSHash:          input.IPFSHash,
		BlockchainTokenID: input.BlockchainTokenID,
		Status:            "pending",
		PlantedAt:         time.Now(),
	}

	if err := config.DB.Create(&tree).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register tree"})
		return
	}

	c.JSON(http.StatusOK, tree)
}

func VerifyTree(c *gin.Context) {
	treeID := c.Param("id")
	var input struct {
		Status string `json:"status" binding:"required"`
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
	tree.Status = input.Status
	tree.VerifiedAt = &now

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
		Status:      input.Status,
		Notes:       input.Notes,
		CreatedAt:   time.Now(),
	}

	if err := tx.Create(&verification).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record verification"})
		return
	}

	// Logic for granting XP and Carbon Credits would go here after successful verification
	// Logic for granting XP and Carbon Credits
	if input.Status == "approved" {
		// 1. Update User XP
		tx.Model(&models.User{}).Where("id = ?", tree.PlanterID).Update("xp_points", gorm.Expr("xp_points + ?", 100))

		// 2. Mint Carbon Credits (Internal Record)
		// Assuming 1 Credit per approval for now as a base reward
		credit := models.CarbonCredit{
			ID:        uuid.New(),
			UserID:    tree.PlanterID,
			TreeID:    tree.ID,
			Amount:    1.0, // 1 Tonne CO2 base credit
			Type:      "verification_reward",
			CreatedAt: time.Now(),
		}
		tx.Create(&credit)
	}

	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "Tree verification completed", "tree": tree})
}
