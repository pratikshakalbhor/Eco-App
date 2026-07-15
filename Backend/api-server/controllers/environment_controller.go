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
		TotalTreesRegistered int64   `json:"total_trees_registered"`
		TotalTreesVerified   int64   `json:"total_trees_verified"`
		TotalTreesCut        int64   `json:"total_trees_cut"`
		TotalReplanted       int64   `json:"total_replanted"`
		ActiveNFTs           int64   `json:"active_nfts"`
		TotalCO2Absorbed     float64 `json:"total_co2_absorbed"`
		TotalCO2Lost         float64 `json:"total_co2_lost"`
		NetCO2Balance        float64 `json:"net_co2_balance"`
		CarbonCreditsGenerated float64 `json:"carbon_credits_generated"`
		CarbonCreditsBurned  float64 `json:"carbon_credits_burned"`
		CO2Offset            float64 `json:"co2_offset"`
		ActiveDebts          int64   `json:"active_debts"`
	}

	config.DB.Model(&models.Tree{}).Count(&stats.TotalTreesRegistered)
	config.DB.Model(&models.Tree{}).Where("status = ?", "VERIFIED").Count(&stats.TotalTreesVerified)
	config.DB.Model(&models.Tree{}).Where("status IN ?", []string{"CUT_REPORTED", "CUT_CONFIRMED"}).Count(&stats.TotalTreesCut)
	config.DB.Model(&models.Tree{}).Where("is_replacement = ?", true).Count(&stats.TotalReplanted)

	// Active NFTs = verified trees that have a blockchain_token_id and are not cut
	config.DB.Model(&models.Tree{}).
		Where("status = ? AND blockchain_token_id IS NOT NULL AND blockchain_token_id != ?", "VERIFIED", "").
		Count(&stats.ActiveNFTs)

	// CO2 Lost from EnvironmentalLoss table
	config.DB.Model(&models.EnvironmentalLoss{}).Select("COALESCE(SUM(co2_lost_kg), 0)").Scan(&stats.TotalCO2Lost)

	// Total carbon credits generated (earned column)
	config.DB.Model(&models.CarbonCredit{}).Where("amount > 0").Select("COALESCE(SUM(amount), 0)").Scan(&stats.TotalCO2Absorbed)

	// Credits burned via ledger (burn events)
	config.DB.Model(&models.CreditLedger{}).Where("event_type = ?", "BURNED").Select("COALESCE(SUM(ABS(amount)), 0)").Scan(&stats.CarbonCreditsBurned)

	stats.CarbonCreditsGenerated = stats.TotalCO2Absorbed
	stats.CO2Offset = stats.CarbonCreditsBurned // 1 burned credit = 1 tonne CO2 offset
	stats.NetCO2Balance = stats.TotalCO2Absorbed - stats.TotalCO2Lost

	config.DB.Model(&models.ReplantationDebt{}).Where("status != ?", "CLEARED").Count(&stats.ActiveDebts)

	c.JSON(http.StatusOK, stats)
}

// GetMonthlyStats — GET /api/environment/monthly-stats
// Uses strftime for SQLite compatibility (also works on PostgreSQL via GORM raw)
func GetMonthlyStats(c *gin.Context) {
	months := 12
	now := time.Now()

	type MonthData struct {
		Month    string  `json:"month"`
		Planted  int64   `json:"planted"`
		Verified int64   `json:"verified"`
		Cut      int64   `json:"cut"`
		Absorbed float64 `json:"absorbed"`
		Lost     float64 `json:"lost"`
		Net      float64 `json:"net"`
	}

	result := make([]MonthData, 0, months)

	for i := months - 1; i >= 0; i-- {
		monthDate := now.AddDate(0, -i, 0)
		monthName := monthDate.Format("Jan")

		// Use strftime which works on SQLite; on PostgreSQL, TO_CHAR is used
		// We form the pattern YYYY-MM for comparison
		yearMonth := monthDate.Format("2006-01")

		var absorbed, lost float64
		var planted, verified, cut int64

		// Trees registered in this month
		config.DB.Model(&models.Tree{}).
			Where("strftime('%Y-%m', created_at) = ? OR TO_CHAR(created_at, 'YYYY-MM') = ?", yearMonth, yearMonth).
			Count(&planted)

		// Trees verified in this month
		config.DB.Model(&models.Tree{}).
			Where("(strftime('%Y-%m', updated_at) = ? OR TO_CHAR(updated_at, 'YYYY-MM') = ?) AND status = ?", yearMonth, yearMonth, "VERIFIED").
			Count(&verified)

		// Trees cut confirmed in this month
		config.DB.Model(&models.Tree{}).
			Where("(strftime('%Y-%m', updated_at) = ? OR TO_CHAR(updated_at, 'YYYY-MM') = ?) AND status = ?", yearMonth, yearMonth, "CUT_CONFIRMED").
			Count(&cut)

		// Carbon credits earned this month
		config.DB.Model(&models.CarbonCredit{}).
			Where("amount > 0 AND (strftime('%Y-%m', created_at) = ? OR TO_CHAR(created_at, 'YYYY-MM') = ?)", yearMonth, yearMonth).
			Select("COALESCE(SUM(amount), 0)").
			Scan(&absorbed)

		// CO2 lost from cuts this month
		config.DB.Model(&models.EnvironmentalLoss{}).
			Where("strftime('%Y-%m', calculated_at) = ? OR TO_CHAR(calculated_at, 'YYYY-MM') = ?", yearMonth, yearMonth).
			Select("COALESCE(SUM(co2_lost_kg), 0)").
			Scan(&lost)

		result = append(result, MonthData{
			Month:    monthName,
			Planted:  planted,
			Verified: verified,
			Cut:      cut,
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
		Species     string  `json:"species"`
		Planted     int64   `json:"planted"`
		Cut         int64   `json:"cut"`
		CO2Absorbed float64 `json:"co2_absorbed"`
		CO2Lost     float64 `json:"co2_lost"`
		Net         float64 `json:"net"`
	}

	var stats []SpeciesStat

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
