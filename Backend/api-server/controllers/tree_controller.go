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

	treeID := "ECO-" + uuid.New().String()[:8]

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
		Status:            "pending_verification",
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

	c.JSON(http.StatusOK, gin.H{"message": "Tree successfully registered", "tree": tree})
}

func GetAllTrees(c *gin.Context) {
	var trees []models.Tree
	if err := config.DB.Preload("Planter").Preload("TreeCutReport").Preload("Verifications").Find(&trees).Error; err != nil {
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
	}

	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "Tree verification completed", "tree": tree})
}

func GetTreeByID(c *gin.Context) {
	treeID := c.Param("id")
	var tree models.Tree
	if err := config.DB.Preload("Planter").Preload("TreeCutReport").Preload("Verifications").First(&tree, "id = ?", treeID).Error; err != nil {
		// Try searching by tree_id string if UUID fails
		if errSearch := config.DB.Preload("Planter").Preload("TreeCutReport").Preload("Verifications").First(&tree, "tree_id = ?", treeID).Error; errSearch != nil {
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
	if err := config.DB.Preload("TreeCutReport").Where("planter_id = ?", userID).Find(&trees).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch trees"})
		return
	}

	c.JSON(http.StatusOK, trees)
}

func GetPendingTrees(c *gin.Context) {
	var trees []models.Tree
	if err := config.DB.Preload("Planter").Where("status = ?", "pending_verification").Find(&trees).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch pending trees"})
		return
	}

	c.JSON(http.StatusOK, trees)
}
