package services

import "testing"

func TestCreditsForTree_DefaultUnit(t *testing.T) {
	// 20 kg/yr * 0.5 yr = 10 kg = 0.01 credits (1 credit = 1 tonne)
	if got := CreditsForTree(20, 0.5); got != 0.01 {
		t.Errorf("CreditsForTree(20, 0.5) = %v, want 0.01", got)
	}
}

func TestCreditsForTree_FallbackRate(t *testing.T) {
	// Non-positive rate falls back to DefaultCarbonAbsorptionRate (18.5 kg/yr)
	want := DefaultCarbonAbsorptionRate / DefaultKgCO2PerCredit
	if got := CreditsForTree(0, 1); got != want {
		t.Errorf("CreditsForTree(0, 1) = %v, want %v", got, want)
	}
}

func TestKgCO2PerCredit_Configurable(t *testing.T) {
	t.Setenv("CARBON_KG_PER_CREDIT", "1")
	// 20 kg/yr * 1 yr = 20 kg = 20 credits at 1 kg/credit
	if got := CreditsForTree(20, 1); got != 20 {
		t.Errorf("with CARBON_KG_PER_CREDIT=1, CreditsForTree(20,1) = %v, want 20", got)
	}
}
