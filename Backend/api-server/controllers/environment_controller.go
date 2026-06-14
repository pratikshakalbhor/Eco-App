package controllers

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func GetEnvironmentStats(c *gin.Context) {
	var totalVerified, totalCut, activeDebts int64
	var co2Absorbed, co2Lost float64

	config.DB.Model(&models.Tree{}).Where("status = ?", "VERIFIED").Count(&totalVerified)
	config.DB.Model(&models.Tree{}).Where("status = ?", "CUT_CONFIRMED").Count(&totalCut)
	config.DB.Model(&models.ReplantationDebt{}).Where("status IN ?", []string{"PENDING", "IN_PROGRESS"}).Count(&activeDebts)

	// CO2 Absorbed Calculation
	// In a real app, this would be a more complex query or pre-calculated field.
	// For this demo, we'll sum the CarbonAbsorptionRate for all VERIFIED trees.
	config.DB.Model(&models.Tree{}).Where("status = ?", "VERIFIED").Select("SUM(carbon_absorption_rate)").Row().Scan(&co2Absorbed)
	
	// CO2 Lost Calculation
	config.DB.Model(&models.EnvironmentalLoss{}).Select("SUM(co2_lost_kg)").Row().Scan(&co2Lost)

	c.JSON(http.StatusOK, gin.H{
		"total_trees_verified":   totalVerified,
		"total_trees_cut":        totalCut,
		"total_co2_absorbed_kg":  co2Absorbed,
		"total_co2_lost_kg":      co2Lost,
		"net_co2_balance_kg":     co2Absorbed - co2Lost,
		"active_replantation_debts": activeDebts,
	})
}

func GetMonthlyStats(c *gin.Context) {
	// For simplicity in this demo, generate mock data for the last 12 months.
	// Real implementation would query the database by grouping created_at/calculated_at by month.
	
	months := []string{"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"}
	currentMonth := int(time.Now().Month())
	
	data := make([]gin.H, 12)
	for i := 0; i < 12; i++ {
		monthIdx := (currentMonth - 11 + i + 12) % 12
		data[i] = gin.H{
			"month":    months[monthIdx],
			"absorbed": 200 + (i * 50), // Mock incrementing absorption
			"lost":     20 + (i * 10),  // Mock incrementing loss
			"net":      180 + (i * 40),
		}
	}

	c.JSON(http.StatusOK, data)
}

func GetSpeciesStats(c *gin.Context) {
	type SpeciesResult struct {
		Species      string  `json:"species"`
		PlantedCount int     `json:"trees_planted"`
		CutCount     int     `json:"trees_cut"`
		CO2Absorbed  float64 `json:"co2_absorbed"`
		CO2Lost      float64 `json:"co2_lost"`
		Net          float64 `json:"net"`
	}

	var results []SpeciesResult

	// Query to aggregate stats per species
	// Note: Standard SQL approach.
	config.DB.Raw(`
		SELECT 
			t.species,
			COUNT(CASE WHEN t.status = 'VERIFIED' THEN 1 END) as planted_count,
			COUNT(CASE WHEN t.status = 'CUT_CONFIRMED' THEN 1 END) as cut_count,
			COALESCE(SUM(CASE WHEN t.status = 'VERIFIED' THEN t.carbon_absorption_rate ELSE 0 END), 0) as co2_absorbed,
			COALESCE(SUM(el.co2_lost_kg), 0) as co2_lost,
			COALESCE(SUM(CASE WHEN t.status = 'VERIFIED' THEN t.carbon_absorption_rate ELSE 0 END), 0) - COALESCE(SUM(el.co2_lost_kg), 0) as net
		FROM trees t
		LEFT JOIN environmental_losses el ON t.tree_id = el.tree_id
		GROUP BY t.species
		ORDER BY net DESC
	`).Scan(&results)

	c.JSON(http.StatusOK, results)
}

func GetRecentActivity(c *gin.Context) {
	var activities []models.ActivityLog
	config.DB.Order("created_at desc").Limit(10).Find(&activities)
	c.JSON(http.StatusOK, activities)
}

func LogActivity(eventType, treeID string, debtID *uuid.UUID, actor, description string) {
	activity := models.ActivityLog{
		EventType:   eventType,
		TreeID:      treeID,
		DebtID:      debtID,
		Actor:       actor,
		Description: description,
		CreatedAt:   time.Now(),
	}
	config.DB.Create(&activity)
}
