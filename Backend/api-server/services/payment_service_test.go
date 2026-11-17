package services

import (
	"math/big"
	"strconv"
	"testing"
)

func TestETHInrRate_NotConfigured(t *testing.T) {
	t.Setenv(EnvETHInrRate, "")
	if _, err := ETHInrRate(); err == nil {
		t.Fatal("expected an error when the rate is not configured")
	}
}

func TestETHInrRate_RejectsUnparseable(t *testing.T) {
	t.Setenv(EnvETHInrRate, "not-a-number")
	if _, err := ETHInrRate(); err == nil {
		t.Fatal("expected an error for an unparseable rate")
	}
}

func TestETHInrRate_RejectsImplausibleValues(t *testing.T) {
	cases := map[string]float64{
		"zero":     0,
		"negative": -320000,
		"too low":  1,
		"too high": 1e12,
	}
	for name, rate := range cases {
		t.Run(name, func(t *testing.T) {
			t.Setenv(EnvETHInrRate, strconv.FormatFloat(rate, 'f', -1, 64))
			if _, err := ETHInrRate(); err == nil {
				t.Fatalf("expected an error for rate %v", rate)
			}
		})
	}
}

func TestETHInrRate_AcceptsValidValue(t *testing.T) {
	t.Setenv(EnvETHInrRate, "320000")
	rate, err := ETHInrRate()
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if rate != 320000 {
		t.Errorf("expected rate 320000, got %v", rate)
	}
}

func TestMinimumPaymentWei_UsesServerSideRate(t *testing.T) {
	t.Setenv(EnvETHInrRate, "320000")

	// 1400 INR at 320000 INR/ETH is 0.004375 ETH.
	expected := EthToWei(1400.0 / 320000.0)
	got, err := MinimumPaymentWei(1400)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if got.Cmp(expected) != 0 {
		t.Errorf("expected %s wei, got %s", expected, got)
	}
}

func TestMinimumPaymentWei_IgnoresAnyClientSuppliedAmount(t *testing.T) {
	t.Setenv(EnvETHInrRate, "320000")

	// The server must derive the requirement purely from the price and the
	// configured rate; a client-supplied rate is not an input to this function
	// at all, so a dust price can never be honoured.
	got, err := MinimumPaymentWei(1400)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	dust := EthToWei(0.0000001)
	if got.Cmp(dust) <= 0 {
		t.Errorf("minimum payment %s wei is not above the dust amount %s wei", got, dust)
	}
}

func TestMinimumPaymentWei_FailsClosedWithoutRate(t *testing.T) {
	t.Setenv(EnvETHInrRate, "")
	if _, err := MinimumPaymentWei(1400); err == nil {
		t.Fatal("expected an error when the rate is not configured")
	}
}

func TestMinimumPaymentWei_RejectsNonPositiveTotal(t *testing.T) {
	t.Setenv(EnvETHInrRate, "320000")
	for _, total := range []float64{0, -1} {
		if _, err := MinimumPaymentWei(total); err == nil {
			t.Errorf("expected an error for total %v", total)
		}
	}
}

func TestEthToWei_ExactConversion(t *testing.T) {
	cases := []struct {
		eth  float64
		wei  string
		desc string
	}{
		{0.0000001, "100000000000", "1e-7 ETH"},
		{0.004375, "4375000000000000", "0.004375 ETH"},
		{1, "1000000000000000000", "1 ETH"},
		{0.1, "100000000000000000", "0.1 ETH"},
	}
	for _, c := range cases {
		got := EthToWei(c.eth)
		if got.String() != c.wei {
			t.Errorf("%s: expected %s wei, got %s", c.desc, c.wei, got)
		}
	}
}

func TestEthToWei_RejectsNonPositive(t *testing.T) {
	for _, eth := range []float64{0, -1} {
		if got := EthToWei(eth); got.Sign() != 0 {
			t.Errorf("expected 0 wei for %v, got %s", eth, got)
		}
	}
}

func TestEthToWei_AboveFloatPrecisionLimit(t *testing.T) {
	// Above 2^53 wei (0.009 ETH) naive float multiplication loses precision.
	// 0.009 ETH == 9_000_000_000_000_000 wei exactly.
	got := EthToWei(0.009)
	want := big.NewInt(9_000_000_000_000_000)
	if got.Cmp(want) != 0 {
		t.Errorf("expected %s wei, got %s", want, got)
	}
}

func TestEthToWei_HandlesLargeAmounts(t *testing.T) {
	got := EthToWei(1234.5678)
	want, _ := new(big.Int).SetString("1234567800000000000000", 10)
	if got.Cmp(want) != 0 {
		t.Errorf("expected %s wei, got %s", want, got)
	}
}
