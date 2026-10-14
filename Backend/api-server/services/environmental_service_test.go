package services

import (
	"ecochain-backend/models"
	"math"
	"testing"
	"time"
)

func approxEqual(a, b, epsilon float64) bool {
	return math.Abs(a-b) < epsilon
}

func TestCalculateEnvironmentalLoss_YoungTree(t *testing.T) {
	tree := models.Tree{
		PlantedAt:            time.Now().AddDate(0, -6, 0), // 6 months ago
		CarbonAbsorptionRate: 20.0,
		Species:              "pine",
	}

	result := CalculateEnvironmentalLoss(tree)

	// 0.5 years * 20 kg/yr = 10 kg CO2
	if !approxEqual(result.CarbonLoss, 10.0, 0.5) {
		t.Errorf("expected CarbonLoss ~10.0, got %f", result.CarbonLoss)
	}
	// O2 = 10 * 0.727 = 7.27 kg
	if !approxEqual(result.OxygenLoss, 7.27, 0.1) {
		t.Errorf("expected OxygenLoss ~7.27, got %f", result.OxygenLoss)
	}
	// max(3, ceil(0.5/2)) = 3
	if result.RequiredTrees != 3 {
		t.Errorf("expected RequiredTrees 3, got %d", result.RequiredTrees)
	}
}

func TestCalculateEnvironmentalLoss_MatureTree(t *testing.T) {
	tree := models.Tree{
		PlantedAt:            time.Now().AddDate(-7, 0, 0), // 7 years ago
		CarbonAbsorptionRate: 25.0,
		Species:              "pine",
	}

	result := CalculateEnvironmentalLoss(tree)

	// 7 years * 25 = 175 kg
	if !approxEqual(result.CarbonLoss, 175.0, 1.0) {
		t.Errorf("expected CarbonLoss ~175.0, got %f", result.CarbonLoss)
	}
	// max(3, ceil(7/2)) = 4
	if result.RequiredTrees != 4 {
		t.Errorf("expected RequiredTrees 4, got %d", result.RequiredTrees)
	}
}

func TestCalculateEnvironmentalLoss_FormulaIsUniversal(t *testing.T) {
	// Species no longer changes the loss/ratio model.
	oak := CalculateEnvironmentalLoss(models.Tree{
		PlantedAt:            time.Now().AddDate(-3, 0, 0),
		CarbonAbsorptionRate: 21.0,
		Species:              "oak",
	})
	other := CalculateEnvironmentalLoss(models.Tree{
		PlantedAt:            time.Now().AddDate(-3, 0, 0),
		CarbonAbsorptionRate: 21.0,
		Species:              "pine",
	})
	if oak != other {
		t.Errorf("expected identical impact regardless of species, got %+v vs %+v", oak, other)
	}
}

func TestCalculateEnvironmentalLoss_VeryNewTree(t *testing.T) {
	tree := models.Tree{
		PlantedAt:            time.Now().Add(-24 * time.Hour), // 1 day ago
		CarbonAbsorptionRate: 30.0,
		Species:              "bamboo",
	}

	result := CalculateEnvironmentalLoss(tree)

	// Minimum age is 0.1 years -> 30 * 0.1 = 3
	if !approxEqual(result.CarbonLoss, 3.0, 0.5) {
		t.Errorf("expected CarbonLoss ~3.0 (30 * 0.1), got %f", result.CarbonLoss)
	}
}

func TestCalculateEnvironmentalLoss_BambooHighRate(t *testing.T) {
	tree := models.Tree{
		PlantedAt:            time.Now().AddDate(-1, 0, 0),
		CarbonAbsorptionRate: 35.0,
		Species:              "bamboo",
	}

	result := CalculateEnvironmentalLoss(tree)

	if !approxEqual(result.CarbonLoss, 35.0, 1.0) {
		t.Errorf("expected CarbonLoss ~35.0, got %f", result.CarbonLoss)
	}
	// O2 = 35 * 0.727 = 25.445 -> 25.45
	if !approxEqual(result.OxygenLoss, 25.45, 0.1) {
		t.Errorf("expected OxygenLoss ~25.45, got %f", result.OxygenLoss)
	}
}

func TestCalculateEnvironmentalLoss_ZeroRateFallsBackToDefault(t *testing.T) {
	tree := models.Tree{
		PlantedAt:            time.Now().AddDate(-1, 0, 0),
		CarbonAbsorptionRate: 0.0,
		Species:              "unknown",
	}

	result := CalculateEnvironmentalLoss(tree)

	// Fallback rate 18.5 kg/yr * 1 year
	if !approxEqual(result.CarbonLoss, DefaultCarbonAbsorptionRate, 0.5) {
		t.Errorf("expected fallback CarbonLoss ~%f, got %f", DefaultCarbonAbsorptionRate, result.CarbonLoss)
	}
}

func TestRequiredReplacementTrees(t *testing.T) {
	cases := []struct {
		years float64
		want  int
	}{
		{0.1, 3},
		{1, 3},
		{5, 3},   // ceil(2.5) = 3
		{6, 3},   // ceil(3) = 3
		{7, 4},   // ceil(3.5) = 4
		{10, 5},  // ceil(5) = 5
		{20, 10}, // ceil(10) = 10
	}
	for _, tc := range cases {
		if got := RequiredReplacementTrees(tc.years); got != tc.want {
			t.Errorf("RequiredReplacementTrees(%v) = %d, want %d", tc.years, got, tc.want)
		}
	}
}
