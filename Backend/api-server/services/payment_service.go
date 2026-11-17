package services

import (
	"fmt"
	"math"
	"math/big"
	"os"
	"strconv"
	"strings"
)

// Marketplace payment pricing.
//
// The minimum payment for a marketplace purchase is derived SERVER-SIDE from
// the configured ETH/INR rate. The client's claimed ETH amount and exchange
// rate are never trusted: if the server accepted them, a buyer could declare a
// dust payment and receive full-price credits.
//
// The rate is supplied by the operator rather than fetched from an oracle.
// That is adequate for a testnet deployment; a production deployment should
// replace ETHInrRate with a real price feed (see SECURITY.md).
const (
	// EnvETHInrRate is the environment variable holding the INR price of one ETH.
	EnvETHInrRate = "ETH_INR_RATE"

	// MinETHInrRate and MaxETHInrRate bound the accepted rate. A value outside
	// the band is treated as misconfiguration rather than as a valid price, so
	// a typo — or a deliberate attempt to configure a tiny rate that makes
	// every purchase trivially cheap — fails closed instead of silently
	// weakening the payment check.
	MinETHInrRate = 1_000.0
	MaxETHInrRate = 100_000_000.0
)

// ETHInrRate returns the configured INR price of one ETH.
//
// It returns an error when the rate is missing, unparseable, non-finite or
// outside the accepted band. Callers must fail closed on that error: an
// unconfigured rate must never degrade into "accept any payment".
func ETHInrRate() (float64, error) {
	raw := strings.TrimSpace(os.Getenv(EnvETHInrRate))
	if raw == "" {
		return 0, fmt.Errorf("%s is not configured", EnvETHInrRate)
	}

	rate, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return 0, fmt.Errorf("%s is not a valid number: %w", EnvETHInrRate, err)
	}
	if math.IsNaN(rate) || math.IsInf(rate, 0) {
		return 0, fmt.Errorf("%s is not a finite number", EnvETHInrRate)
	}
	if rate < MinETHInrRate || rate > MaxETHInrRate {
		return 0, fmt.Errorf("%s=%.2f is outside the accepted range [%.0f, %.0f]",
			EnvETHInrRate, rate, MinETHInrRate, MaxETHInrRate)
	}

	return rate, nil
}

// MinimumPaymentWei returns the minimum number of wei a buyer must have
// transferred for a purchase worth totalINR rupees, computed from the
// server-side ETH/INR rate.
func MinimumPaymentWei(totalINR float64) (*big.Int, error) {
	if math.IsNaN(totalINR) || math.IsInf(totalINR, 0) || totalINR <= 0 {
		return nil, fmt.Errorf("purchase total must be a positive amount, got %.4f", totalINR)
	}

	rate, err := ETHInrRate()
	if err != nil {
		return nil, err
	}

	minWei := EthToWei(totalINR / rate)
	if minWei.Sign() == 0 {
		return nil, fmt.Errorf("computed payment amount is zero for a total of %.4f INR", totalINR)
	}

	return minWei, nil
}
