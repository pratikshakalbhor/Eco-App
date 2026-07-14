package controllers

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// GetEnvironmentStats — GET /api/environment/stats
func GetEnvironmentStats(c *gin.Context) {
	var stats struct {
		TotalTreesVerified  int64   `json:"total_trees_verified"`
		TotalTreesCut       int64   `json:"total_trees_cut"`
		TotalCO2Absorbed    float64 `json:"total_co2_absorbed"`
		TotalCO2Lost        float64 `json:"total_co2_lost"`
		NetCO2Balance       float64 `json:"net_co2_balance"`
		ActiveDebts         int64   `json:"active_debts"`
	}

	config.DB.Model(&models.Tree{}).Where("status = ?", "VERIFIED").Count(&stats.TotalTreesVerified)
	config.DB.Model(&models.Tree{}).Where("status = ?", "CUT_CONFIRMED").Count(&stats.TotalTreesCut)

	// Sum CO2 Lost from EnvironmentalLoss table
	config.DB.Model(&models.EnvironmentalLoss{}).Select("COALESCE(SUM(co2_lost_kg), 0)").Scan(&stats.TotalCO2Lost)

	// Estimate total CO2 absorbed by all verified trees
	// Simplified: Sum (absorption_rate * years_lived)
	// For performance, we'll sum the carbon credits generated (1 credit = 1 kg CO2)
	config.DB.Model(&models.CarbonCredit{}).Where("amount > 0").Select("COALESCE(SUM(amount), 0)").Scan(&stats.TotalCO2Absorbed)

	stats.NetCO2Balance = stats.TotalCO2Absorbed - stats.TotalCO2Lost

	config.DB.Model(&models.ReplantationDebt{}).Where("status != ?", "CLEARED").Count(&stats.ActiveDebts)

	c.JSON(http.StatusOK, stats)
}

// GetMonthlyStats — GET /api/environment/monthly-stats
func GetMonthlyStats(c *gin.Context) {
	months := 12
	now := time.Now()
	
	type MonthData struct {
		Month    string  `json:"month"`
		Absorbed float64 `json:"absorbed"`
		Lost     float64 `json:"lost"`
		Net      float64 `json:"net"`
	}

	result := make([]MonthData, 0)

	for i := months - 1; i >= 0; i-- {
		monthDate := now.AddDate(0, -i, 0)
		monthName := monthDate.Format("Jan")
		yearMonth := monthDate.Format("2006-01")

		var absorbed, lost float64

		// Sum credits earned in this month
		config.DB.Model(&models.CarbonCredit{}).
			Where("amount > 0 AND TO_CHAR(created_at, 'YYYY-MM') = ?", yearMonth).
			Select("COALESCE(SUM(amount), 0)").
			Scan(&absorbed)

		// Sum CO2 lost from removals confirmed in this month
		config.DB.Model(&models.EnvironmentalLoss{}).
			Where("TO_CHAR(calculated_at, 'YYYY-MM') = ?", yearMonth).
			Select("COALESCE(SUM(co2_lost_kg), 0)").
			Scan(&lost)

		result = append(result, MonthData{
			Month:    monthName,
			Absorbed: absorbed,
			Lost:     lost,
			Net:      absorbed - lost,
		})
	}

	c.JSON(http.StatusOK, result)
}

// GetSpeciesStats — GET /api/environment/species-stats
func GetSpeciesStats(c *gin.Context) {
	type SpeciesStat struct {
		Species      string  `json:"species"`
		Planted      int64   `json:"planted"`
		Cut          int64   `json:"cut"`
		CO2Absorbed  float64 `json:"co2_absorbed"`
		CO2Lost      float64 `json:"co2_lost"`
		Net          float64 `json:"net"`
	}

	var stats []SpeciesStat

	// This is a complex query, we'll use raw SQL for efficiency
	query := `
		SELECT 
			t.species,
			COUNT(CASE WHEN t.status IN ('VERIFIED', 'CUT_REPORTED', 'CUT_CONFIRMED') THEN 1 END) as planted,
			COUNT(CASE WHEN t.status = 'CUT_CONFIRMED' THEN 1 END) as cut,
			COALESCE(SUM(cc.amount), 0) as co2_absorbed,
			COALESCE(SUM(el.co2_lost_kg), 0) as co2_lost
		FROM trees t
		LEFT JOIN carbon_credits cc ON t.id = cc.tree_id AND cc.amount > 0
		LEFT JOIN environmental_losses el ON t.tree_id = el.tree_id
		GROUP BY t.species
		ORDER BY (COALESCE(SUM(cc.amount), 0) - COALESCE(SUM(el.co2_lost_kg), 0)) DESC
	`

	rows, err := config.DB.Raw(query).Rows()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch species stats"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var s SpeciesStat
		rows.Scan(&s.Species, &s.Planted, &s.Cut, &s.CO2Absorbed, &s.CO2Lost)
		s.Net = s.CO2Absorbed - s.CO2Lost
		stats = append(stats, s)
	}

	c.JSON(http.StatusOK, stats)
}
