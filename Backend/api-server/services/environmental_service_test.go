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
		PlantedAt:           time.Now().AddDate(0, -6, 0), // 6 months ago
		CarbonAbsorptionRate: 20.0,
		Species:             "pine",
	}

	result := CalculateEnvironmentalLoss(tree)

	// 6 months = 0.5 years, carbonLoss = 20 * 0.5 = 10
	if !approxEqual(result.CarbonLoss, 10.0, 1.0) {
		t.Errorf("expected CarbonLoss ~10.0, got %f", result.CarbonLoss)
	}

	// oxygenLoss = 10 * 1.5 = 15
	if !approxEqual(result.OxygenLoss, 15.0, 1.5) {
		t.Errorf("expected OxygenLoss ~15.0, got %f", result.OxygenLoss)
	}

	// young tree (< 5 years), not oak/teak => ratio = 3
	if result.CompensationRatio != 3 {
		t.Errorf("expected CompensationRatio 3, got %d", result.CompensationRatio)
	}
}

func TestCalculateEnvironmentalLoss_MatureTree(t *testing.T) {
	tree := models.Tree{
		PlantedAt:           time.Now().AddDate(-6, 0, 0), // 6 years ago
		CarbonAbsorptionRate: 25.0,
		Species:             "pine",
	}

	result := CalculateEnvironmentalLoss(tree)

	// 6 years, carbonLoss = 25 * 6 = 150
	if !approxEqual(result.CarbonLoss, 150.0, 1.0) {
		t.Errorf("expected CarbonLoss ~150.0, got %f", result.CarbonLoss)
	}

	// mature tree (> 5 years) => ratio = 5
	if result.CompensationRatio != 5 {
		t.Errorf("expected CompensationRatio 5, got %d", result.CompensationRatio)
	}
}

func TestCalculateEnvironmentalLoss_OakTree(t *testing.T) {
	tree := models.Tree{
		PlantedAt:           time.Now().AddDate(-3, 0, 0), // 3 years ago
		CarbonAbsorptionRate: 21.0,
		Species:             "oak",
	}

	result := CalculateEnvironmentalLoss(tree)

	// oak => ratio = 10 regardless of age
	if result.CompensationRatio != 10 {
		t.Errorf("expected CompensationRatio 10 for oak, got %d", result.CompensationRatio)
	}
}

func TestCalculateEnvironmentalLoss_TeakTree(t *testing.T) {
	tree := models.Tree{
		PlantedAt:           time.Now().AddDate(-2, 0, 0), // 2 years ago
		CarbonAbsorptionRate: 25.0,
		Species:             "teak",
	}

	result := CalculateEnvironmentalLoss(tree)

	// teak => ratio = 10
	if result.CompensationRatio != 10 {
		t.Errorf("expected CompensationRatio 10 for teak, got %d", result.CompensationRatio)
	}
}

func TestCalculateEnvironmentalLoss_VeryNewTree(t *testing.T) {
	tree := models.Tree{
		PlantedAt:           time.Now().Add(-24 * time.Hour), // 1 day ago
		CarbonAbsorptionRate: 30.0,
		Species:             "bamboo",
	}

	result := CalculateEnvironmentalLoss(tree)

	// Minimum age is 0.1 years
	if !approxEqual(result.CarbonLoss, 3.0, 0.5) {
		t.Errorf("expected CarbonLoss ~3.0 (30 * 0.1), got %f", result.CarbonLoss)
	}
}

func TestCalculateEnvironmentalLoss_BambooHighRate(t *testing.T) {
	tree := models.Tree{
		PlantedAt:           time.Now().AddDate(-1, 0, 0), // 1 year ago
		CarbonAbsorptionRate: 35.0,
		Species:             "bamboo",
	}

	result := CalculateEnvironmentalLoss(tree)

	// 1 year, bamboo 35 => carbonLoss = 35
	if !approxEqual(result.CarbonLoss, 35.0, 1.0) {
		t.Errorf("expected CarbonLoss ~35.0, got %f", result.CarbonLoss)
	}

	// oxygen = 35 * 1.5 = 52.5
	if !approxEqual(result.OxygenLoss, 52.5, 1.5) {
		t.Errorf("expected OxygenLoss ~52.5, got %f", result.OxygenLoss)
	}

	// young, not oak/teak => ratio = 3
	if result.CompensationRatio != 3 {
		t.Errorf("expected CompensationRatio 3, got %d", result.CompensationRatio)
	}
}

func TestCalculateEnvironmentalLoss_ZeroAbsorptionRate(t *testing.T) {
	tree := models.Tree{
		PlantedAt:           time.Now().AddDate(-1, 0, 0),
		CarbonAbsorptionRate: 0.0,
		Species:             "unknown",
	}

	result := CalculateEnvironmentalLoss(tree)

	if result.CarbonLoss != 0 {
		t.Errorf("expected CarbonLoss 0 for zero rate, got %f", result.CarbonLoss)
	}
	if result.OxygenLoss != 0 {
		t.Errorf("expected OxygenLoss 0 for zero rate, got %f", result.OxygenLoss)
	}
}

func TestCalculateEnvironmentalLoss_OldOakProtected(t *testing.T) {
	tree := models.Tree{
		PlantedAt:           time.Now().AddDate(-10, 0, 0), // 10 years
		CarbonAbsorptionRate: 21.0,
		Species:             "oak",
	}

	result := CalculateEnvironmentalLoss(tree)

	// oak always = 10 ratio regardless of being mature
	if result.CompensationRatio != 10 {
		t.Errorf("expected CompensationRatio 10 for old oak, got %d", result.CompensationRatio)
	}

	// RequiredTrees should equal CompensationRatio (simplified)
	if result.RequiredTrees != 10 {
		t.Errorf("expected RequiredTrees 10, got %d", result.RequiredTrees)
	}
}
