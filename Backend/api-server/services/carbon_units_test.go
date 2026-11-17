package services

import (
	"math"
	"testing"
)

func TestCanonicalCarbonUnitConversions(t *testing.T) {
	t.Setenv("CARBON_KG_PER_CREDIT", "")

	if got := CreditsToKg(1); got != 1000 {
		t.Errorf("expected 1 credit = 1000 kg, got %v", got)
	}
	if got := CreditsToKg(0.5); got != 500 {
		t.Errorf("expected 0.5 credits = 500 kg, got %v", got)
	}
	if got := KgToCredits(1000); got != 1 {
		t.Errorf("expected 1000 kg = 1 credit, got %v", got)
	}
	if got := NetCO2BalanceKg(1000, 250); got != 750 {
		t.Errorf("expected 750 kg net, got %v", got)
	}
	if got := NetCO2BalanceKg(250, 1000); got != -750 {
		t.Errorf("expected -750 kg net, got %v", got)
	}
}

func TestCarbonUnitConversionsHonourConfiguredCreditSize(t *testing.T) {
	t.Setenv("CARBON_KG_PER_CREDIT", "500")

	if got := CreditsToKg(1); got != 500 {
		t.Errorf("expected 1 credit = 500 kg with the override, got %v", got)
	}
	if got := KgToCredits(500); got != 1 {
		t.Errorf("expected 500 kg = 1 credit with the override, got %v", got)
	}
}

func TestCarbonUnitConversionsIgnoreInvalidOverride(t *testing.T) {
	t.Setenv("CARBON_KG_PER_CREDIT", "not-a-number")
	if got := CreditsToKg(1); got != DefaultKgCO2PerCredit {
		t.Errorf("expected the default credit size, got %v", got)
	}

	t.Setenv("CARBON_KG_PER_CREDIT", "-5")
	if got := CreditsToKg(1); got != DefaultKgCO2PerCredit {
		t.Errorf("expected a non-positive override to fall back to the default, got %v", got)
	}
}

func TestCreditsForTreeRoundsToFourDecimals(t *testing.T) {
	t.Setenv("CARBON_KG_PER_CREDIT", "1000")

	// 20 kg/yr for 0.55 years = 11 kg = 0.011 credits.
	got := CreditsForTree(20, 0.55)
	want := 0.011
	if math.Abs(got-want) > 1e-9 {
		t.Errorf("expected %v credits, got %v", want, got)
	}

	// A non-positive rate falls back to the default absorption rate.
	if CreditsForTree(0, 1) <= 0 {
		t.Error("expected a positive credit amount for the default rate")
	}
}
