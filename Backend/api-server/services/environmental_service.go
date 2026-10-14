package services

import (
	"ecochain-backend/models"
	"math"
	"time"
)

// Shared carbon accounting constants. These are the single source of truth for
// both the environmental-loss calculation and the carbon-credit issuance model.
const (
	// DefaultCarbonAbsorptionRate is used when a tree has no recorded rate.
	// Value in kg of CO2 sequestered per year (mid-range broadleaf estimate).
	DefaultCarbonAbsorptionRate = 18.5

	// OxygenToCarbonMassRatio is the mass of O2 released per kg of CO2 fixed by
	// photosynthesis (6CO2 + 6H2O -> C6H12O6 + 6O2). Molar masses give
	// 6*32 / 6*44 = 32/44 = 0.727 kg O2 per kg CO2.
	OxygenToCarbonMassRatio = 0.727

	// MinTreeAgeYears floors a tree's age so brand-new trees still produce a
	// deterministic, non-zero impact.
	MinTreeAgeYears = 0.1
)

// EnvironmentalImpact describes the modelled effect of removing a single tree.
type EnvironmentalImpact struct {
	CarbonLoss    float64 // kg CO2 sequestered to date and now lost
	OxygenLoss    float64 // kg O2 no longer produced
	RequiredTrees int     // replacement trees required to compensate
}

// TreeAgeYears returns a tree's age in years, floored at MinTreeAgeYears.
func TreeAgeYears(plantedAt time.Time) float64 {
	years := time.Since(plantedAt).Hours() / 24 / 365
	if years < MinTreeAgeYears {
		years = MinTreeAgeYears
	}
	return years
}

// RequiredReplacementTrees is the authoritative replantation formula:
//
//	trees = max(3, ceil(ageYears / 2))
//
// The floor of 3 guarantees a minimum restoration commitment for every cut,
// and the age term scales the obligation with the tree's age. This formula is
// mirrored by the frontend (VerificationQueue) and the on-chain replantation
// debt, so it must only be changed in one place.
func RequiredReplacementTrees(ageYears float64) int {
	return int(math.Max(3, math.Ceil(ageYears/2)))
}

// CalculateEnvironmentalLoss estimates the impact of removing a tree:
//
//	CO2 lost  = CarbonAbsorptionRate (kg/yr) * age (yr)
//	O2 lost   = CO2 lost * 0.727
//	trees     = RequiredReplacementTrees(age)
//
// A non-positive absorption rate falls back to DefaultCarbonAbsorptionRate.
func CalculateEnvironmentalLoss(tree models.Tree) EnvironmentalImpact {
	years := TreeAgeYears(tree.PlantedAt)

	rate := tree.CarbonAbsorptionRate
	if rate <= 0 {
		rate = DefaultCarbonAbsorptionRate
	}

	carbonLoss := rate * years
	oxygenLoss := carbonLoss * OxygenToCarbonMassRatio

	return EnvironmentalImpact{
		CarbonLoss:    round2(carbonLoss),
		OxygenLoss:    round2(oxygenLoss),
		RequiredTrees: RequiredReplacementTrees(years),
	}
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}
