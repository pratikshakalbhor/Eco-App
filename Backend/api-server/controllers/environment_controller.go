package controllers

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"ecochain-backend/services"
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
)

// Unit convention for every environment endpoint:
//   - carbon_credits.amount is in CREDITS (1 credit = services.KgCO2PerCredit() kg);
//   - environmental_losses.co2_lost_kg and tree absorption rates are in KG.
//
// All CO2 fields returned to clients are kilograms; credit-count fields stay in
// credits. Conversions go through services.CreditsToKg / NetCO2BalanceKg so the
// two units can never be added directly again.

// GetEnvironmentStats — GET /api/environment/stats
func GetEnvironmentStats(c *gin.Context) {
	var stats struct {
		TotalTreesRegistered   int64   `json:"total_trees_registered"`
		TotalTreesVerified     int64   `json:"total_trees_verified"`
		TotalTreesCut          int64   `json:"total_trees_cut"`
		TotalReplanted         int64   `json:"total_replanted"`
		ActiveNFTs             int64   `json:"active_nfts"`
		TotalCO2Absorbed       float64 `json:"total_co2_absorbed"`
		TotalCO2Lost           float64 `json:"total_co2_lost"`
		NetCO2Balance          float64 `json:"net_co2_balance"`
		CarbonCreditsGenerated float64 `json:"carbon_credits_generated"`
		CarbonCreditsBurned    float64 `json:"carbon_credits_burned"`
		CO2Offset              float64 `json:"co2_offset"`
		ActiveDebts            int64   `json:"active_debts"`
	}

	config.DB.Model(&models.Tree{}).Count(&stats.TotalTreesRegistered)
	config.DB.Model(&models.Tree{}).Where("status = ?", "VERIFIED").Count(&stats.TotalTreesVerified)
	config.DB.Model(&models.Tree{}).Where("status IN ?", []string{"CUT_REPORTED", "CUT_CONFIRMED"}).Count(&stats.TotalTreesCut)
	config.DB.Model(&models.Tree{}).Where("is_replacement = ?", true).Count(&stats.TotalReplanted)

	// Active NFTs = verified trees that have a blockchain_token_id and are not cut
	config.DB.Model(&models.Tree{}).
		Where("status = ? AND blockchain_token_id IS NOT NULL AND blockchain_token_id != ?", "VERIFIED", "").
		Count(&stats.ActiveNFTs)

	// CO2 Lost from EnvironmentalLoss table (kg)
	config.DB.Model(&models.EnvironmentalLoss{}).Select("COALESCE(SUM(co2_lost_kg), 0)").Scan(&stats.TotalCO2Lost)

	// Credits earned / burned are counted in CREDITS ...
	config.DB.Model(&models.CarbonCredit{}).Where("amount > 0").Select("COALESCE(SUM(amount), 0)").Scan(&stats.CarbonCreditsGenerated)

	config.DB.Model(&models.CreditLedger{}).Where("event_type = ?", "BURNED").Select("COALESCE(SUM(ABS(amount)), 0)").Scan(&stats.CarbonCreditsBurned)

	// ... and converted to kg for every CO2 field. Adding credits to kg was the
	// original bug: 1 credit (1000 kg) looked like 1 kg of absorption.
	stats.TotalCO2Absorbed = services.CreditsToKg(stats.CarbonCreditsGenerated)
	stats.CO2Offset = services.CreditsToKg(stats.CarbonCreditsBurned)
	stats.NetCO2Balance = services.NetCO2BalanceKg(stats.TotalCO2Absorbed, stats.TotalCO2Lost)

	config.DB.Model(&models.ReplantationDebt{}).Where("status != ?", "CLEARED").Count(&stats.ActiveDebts)

	c.JSON(http.StatusOK, stats)
}

// GetMonthlyStats — GET /api/environment/monthly-stats
// Month bucketing is done with time ranges computed in Go so the same query
// works on both SQLite and PostgreSQL (no dialect-specific date functions).
func GetMonthlyStats(c *gin.Context) {
	const months = 12
	now := time.Now()

	// Anchor on the first day of the current month. Anchoring avoids the
	// time.AddDate day-of-month overflow (e.g. Mar 31 - 1 month = Mar 3).
	firstOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

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
		start := firstOfMonth.AddDate(0, -i, 0)
		end := start.AddDate(0, 1, 0)
		monthName := start.Format("Jan")

		var absorbed, lost float64
		var planted, verified, cut int64

		// Trees registered in this month
		config.DB.Model(&models.Tree{}).
			Where("created_at >= ? AND created_at < ?", start, end).
			Count(&planted)

		// Trees verified in this month
		config.DB.Model(&models.Tree{}).
			Where("updated_at >= ? AND updated_at < ? AND status = ?", start, end, "VERIFIED").
			Count(&verified)

		// Trees cut confirmed in this month
		config.DB.Model(&models.Tree{}).
			Where("updated_at >= ? AND updated_at < ? AND status = ?", start, end, "CUT_CONFIRMED").
			Count(&cut)

		// Carbon credits earned this month (credits → kg)
		var earnedCredits float64
		config.DB.Model(&models.CarbonCredit{}).
			Where("amount > 0 AND created_at >= ? AND created_at < ?", start, end).
			Select("COALESCE(SUM(amount), 0)").
			Scan(&earnedCredits)
		absorbed = services.CreditsToKg(earnedCredits)

		// CO2 lost from cuts this month (kg)
		config.DB.Model(&models.EnvironmentalLoss{}).
			Where("calculated_at >= ? AND calculated_at < ?", start, end).
			Select("COALESCE(SUM(co2_lost_kg), 0)").
			Scan(&lost)

		result = append(result, MonthData{
			Month:    monthName,
			Planted:  planted,
			Verified: verified,
			Cut:      cut,
			Absorbed: absorbed,
			Lost:     lost,
			Net:      services.NetCO2BalanceKg(absorbed, lost),
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

	// Correlated subqueries keep one row per species. Joining both tables at
	// once multiplies rows when a tree has several credits or losses, which
	// inflated every SUM.
	query := `
		SELECT
			t.species,
			COUNT(CASE WHEN t.status IN ('VERIFIED', 'CUT_REPORTED', 'CUT_CONFIRMED') THEN 1 END) as planted,
			COUNT(CASE WHEN t.status = 'CUT_CONFIRMED' THEN 1 END) as cut,
			COALESCE((
				SELECT SUM(cc.amount) FROM carbon_credits cc
				WHERE cc.tree_id = t.id AND cc.amount > 0
			), 0) as credits_absorbed,
			COALESCE((
				SELECT SUM(el.co2_lost_kg) FROM environmental_losses el
				WHERE el.tree_id = t.tree_id
			), 0) as co2_lost
		FROM trees t
		GROUP BY t.species
	`

	rows, err := config.DB.Raw(query).Rows()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch species stats"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var s SpeciesStat
		var creditsAbsorbed float64
		if err := rows.Scan(&s.Species, &s.Planted, &s.Cut, &creditsAbsorbed, &s.CO2Lost); err != nil {
			continue
		}
		s.CO2Absorbed = services.CreditsToKg(creditsAbsorbed)
		s.Net = services.NetCO2BalanceKg(s.CO2Absorbed, s.CO2Lost)
		stats = append(stats, s)
	}

	// Rank by net CO2 in kg, descending (done in Go because the stored units
	// differ).
	sort.SliceStable(stats, func(i, j int) bool { return stats[i].Net > stats[j].Net })

	c.JSON(http.StatusOK, stats)
}
