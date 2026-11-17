package services

import (
	"errors"
	"math/big"
	"testing"
)

func TestVerifyNativePayment_RequiresRpcUrl(t *testing.T) {
	t.Setenv("RPC_URL", "")
	err := VerifyNativePayment("0xabc", "0xto", "0xfrom", big.NewInt(1))
	if !errors.Is(err, ErrRPCNotConfigured) {
		t.Fatalf("expected ErrRPCNotConfigured, got %v", err)
	}
}

func TestVerifyNativePayment_RejectsMalformedTxHash(t *testing.T) {
	// RPC_URL is set but unreachable; the format check must run before the
	// connection attempt so a malformed hash never reaches the node.
	t.Setenv("RPC_URL", "http://127.0.0.1:1")

	for _, hash := range []string{"", "0x", "0xdeadbeef", "not-a-hash", "0xZZZZ"} {
		if err := VerifyNativePayment(hash, "0xto", "0xfrom", big.NewInt(1)); err == nil {
			t.Errorf("expected an error for malformed tx hash %q", hash)
		}
	}
}

func TestVerifyNativePayment_RejectsEmptyAddresses(t *testing.T) {
	t.Setenv("RPC_URL", "http://127.0.0.1:1")
	validHash := "0x" + "ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12cd34"

	if err := VerifyNativePayment(validHash, "", "0xfrom", big.NewInt(1)); err == nil {
		t.Error("expected an error for an empty recipient")
	}
	if err := VerifyNativePayment(validHash, "0xto", "", big.NewInt(1)); err == nil {
		t.Error("expected an error for an empty sender")
	}
}
