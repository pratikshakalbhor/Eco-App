package services

import (
	"math"
	"os"
	"strconv"
)

// Carbon credit issuance model — documented and configurable.
//
// Project assumptions:
//   - One carbon credit represents 1 tonne (1000 kg) of CO2e, matching the
//     marketplace unit and the "environmental debt" display in the UI.
//   - When a tree is verified it is issued credits for the CO2 it has
//     sequestered to date:  credits = rate(kg/yr) * age(yr) / kgPerCredit.
//
// This replaces the previous hardcoded Amount: 1.0 per verification.
//
// Override via environment:
//
//	CARBON_KG_PER_CREDIT  kg of CO2e represented by one credit (default 1000)
const DefaultKgCO2PerCredit = 1000.0

// KgCO2PerCredit returns the configurable kg-of-CO2e value of a single credit.
func KgCO2PerCredit() float64 {
	if v, err := strconv.ParseFloat(os.Getenv("CARBON_KG_PER_CREDIT"), 64); err == nil && v > 0 {
		return v
	}
	return DefaultKgCO2PerCredit
}

// CreditsForTree returns the credits issued when a tree is verified, based on
// the CO2 it has sequestered to date (rate * age) converted to credits.
// A non-positive rate falls back to DefaultCarbonAbsorptionRate.
func CreditsForTree(rateKgPerYear, ageYears float64) float64 {
	if rateKgPerYear <= 0 {
		rateKgPerYear = DefaultCarbonAbsorptionRate
	}
	kg := rateKgPerYear * ageYears
	return math.Round((kg/KgCO2PerCredit())*10000) / 10000
}

// Canonical CO2 unit conversions.
//
// The database stores two different quantities:
//   - carbon_credits.amount is in CREDITS (1 credit = KgCO2PerCredit() kg);
//   - environmental_losses.co2_lost_kg and tree absorption rates are in KG.
//
// Adding the two without converting silently overstates (or understates) the
// result by a factor of 1000. Every endpoint that combines them must go
// through CreditsToKg/KgToCredits/NetCO2BalanceKg.

// CreditsToKg converts a credit amount to kilograms of CO2e.
func CreditsToKg(credits float64) float64 {
	return credits * KgCO2PerCredit()
}

// KgToCredits converts kilograms of CO2e to credits.
func KgToCredits(kg float64) float64 {
	return kg / KgCO2PerCredit()
}

// NetCO2BalanceKg returns absorbed minus lost CO2e. Both arguments MUST be in
// kilograms; this helper exists so a credits value cannot be passed by
// accident in one of the two positions.
func NetCO2BalanceKg(absorbedKg, lostKg float64) float64 {
	return absorbedKg - lostKg
}
