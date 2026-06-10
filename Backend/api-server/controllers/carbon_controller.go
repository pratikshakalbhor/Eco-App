package controllers

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"net/http"
	"time"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AbsorptionRates Species-based carbon absorption coefficients (kg/year)
var AbsorptionRates = map[string]float64{
	"mango":  22.0,
	"neem":   18.5,
	"oak":    25.0,
	"bamboo": 12.0,
}

func GetUserCarbonCredits(c *gin.Context) {
	userIDString, _ := c.Get("userID")
	userID, _ := uuid.Parse(userIDString.(string))

	var credits []models.CarbonCredit
	if err := config.DB.Where("user_id = ?", userID).Order("created_at desc").Find(&credits).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch credits"})
		return
	}

	var trees []models.Tree
	if err := config.DB.Where("planter_id = ?", userID).Find(&trees).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch trees"})
		return
	}

	var totalBalance, creditsEarned, creditsLost float64
	var activeTrees int
	var totalCO2Absorption, totalOxygenGen float64

	for _, credit := range credits {
		totalBalance += credit.Amount
		if credit.Amount > 0 {
			creditsEarned += credit.Amount
		} else {
			creditsLost += MathAbs(credit.Amount)
		}
	}

	for _, tree := range trees {
		if tree.Status == "verified" {
			activeTrees++
			// Calculation approximation: CO2 absorbed since planting
			years := time.Since(tree.PlantedAt).Hours() / 24 / 365
			totalCO2Absorption += tree.CarbonAbsorptionRate * years
			// Oxygen gen roughly 1.5x CO2 absorption by mass (simplistic environmental model)
			totalOxygenGen += tree.CarbonAbsorptionRate * years * 1.5
		}
	}

	// Sustainability Score: 100 base
	sustainabilityScore := 100.0

	c.JSON(http.StatusOK, gin.H{
		"carbon_balance":         totalBalance,
		"credits_earned":         creditsEarned,
		"credits_lost":           creditsLost,
		"active_trees":           activeTrees,
		"co2_stats": gin.H{
			"total_absorbed": totalCO2Absorption,
			"avg_rate":       totalCO2Absorption / (float64(activeTrees) + 0.1),
		},
		"oxygen_stats": gin.H{
			"total_generated": totalOxygenGen,
		},
		"sustainability_score": sustainabilityScore,
		"history":              credits,
	})
}

func MathAbs(v float64) float64 {
	if v < 0 {
		return -v
	}
	return v
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
