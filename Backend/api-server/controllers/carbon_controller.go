package controllers

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"net/http"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Species-based carbon absorption coefficients (kg/year)
var absorptionRates = map[string]float64{
	"mango":  22.0,
	"neem":   18.5,
	"oak":    25.0,
	"bamboo": 12.0,
}

func GetUserCarbonCredits(c *gin.Context) {
	userIDString, _ := c.Get("userID")
	userID, _ := uuid.Parse(userIDString.(string))

	var credits []models.CarbonCredit
	if err := config.DB.Where("user_id = ?", userID).Find(&credits).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch credits"})
		return
	}

	var total float64
	for _, c := range credits {
		total += c.Amount
	}

	c.JSON(http.StatusOK, gin.H{
		"total_credits": total,
		"history":       credits,
	})
}

func MintCreditsForTree(treeID uuid.UUID, amount float64, txHash string) error {
	var tree models.Tree
	if err := config.DB.First(&tree, "id = ?", treeID).Error; err != nil {
		return err
	}

	credit := models.CarbonCredit{
		ID:              uuid.New(),
		UserID:          tree.PlanterID,
		TreeID:          tree.ID,
		Amount:          amount,
		TransactionHash: txHash,
		Type:            "minted",
	}

	return config.DB.Create(&credit).Error
}
