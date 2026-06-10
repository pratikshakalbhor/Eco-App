package services

import (
	"ecochain-backend/models"
	"math"
	"time"
)

type EnvironmentalImpact struct {
	CarbonLoss        float64 // in kg
	OxygenLoss        float64 // in kg
	CompensationRatio int
	RequiredTrees     int
}

// CalculateEnvironmentalLoss estimates the impact of removing a tree
func CalculateEnvironmentalLoss(tree models.Tree) EnvironmentalImpact {
	// 1. Calculate age in years
	years := time.Since(tree.PlantedAt).Hours() / 24 / 365
	if years < 0.1 {
		years = 0.1 // Minimum age for calculation
	}

	// 2. Carbon Loss = Annual Rate * Age (simplified model of sequestered carbon)
	// In reality, this would be a more complex sigmoidal growth curve
	carbonLoss := tree.CarbonAbsorptionRate * years

	// 3. Oxygen Loss proportional to carbon (mass balance of photosynthesis)
	// Roughly 1.5 - 2.5 kg of O2 for every 1 kg of CO2 sequestered
	oxygenLoss := carbonLoss * 1.5

	// 4. Determine Compensation Ratio based on species and age
	// Mature trees or protected species have higher ratios
	ratio := 3 // Default 3:1
	if years > 5 {
		ratio = 5 // Mature tree 5:1
	}
	if tree.Species == "oak" || tree.Species == "teak" {
		ratio = 10 // Protected/Slow-growing species 10:1
	}

	return EnvironmentalImpact{
		CarbonLoss:        math.Round(carbonLoss*100) / 100,
		OxygenLoss:        math.Round(oxygenLoss*100) / 100,
		CompensationRatio: ratio,
		RequiredTrees:     ratio, // Simplified for now
	}
}
