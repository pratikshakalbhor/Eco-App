package services

import (
	"errors"
	"math/big"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

// ─────────────────────────────────────────────────
// EcoToken burn decoding
// ─────────────────────────────────────────────────

func transferLog(from, to common.Address, amount int64) *types.Log {
	return &types.Log{
		Topics: []common.Hash{
			erc20TransferTopic,
			topicAddr(from),
			topicAddr(to),
		},
		Data: word(amount),
	}
}

func TestDecodeCreditBurnFromReceipt_AcceptsTransferToZero(t *testing.T) {
	token := testAddr(0x70)
	burner := testAddr(0x01)
	receipt := testReceipt(token, transferLog(burner, common.Address{}, 2_500_000_000_000_000_000))

	burn, err := decodeCreditBurnFromReceipt(receipt, token)
	if err != nil {
		t.Fatalf("expected a decoded burn: %v", err)
	}
	if burn.From != burner {
		t.Errorf("expected burner %s, got %s", burner.Hex(), burn.From.Hex())
	}
	if burn.Amount.String() != "2500000000000000000" {
		t.Errorf("expected 2.5e18 wei, got %s", burn.Amount)
	}
	if burn.Token != token {
		t.Errorf("expected token %s, got %s", token.Hex(), burn.Token.Hex())
	}
}

func TestDecodeCreditBurnFromReceipt_IgnoresNormalTransfers(t *testing.T) {
	token := testAddr(0x70)
	receipt := testReceipt(token, transferLog(testAddr(0x01), testAddr(0x02), 100))

	if _, err := decodeCreditBurnFromReceipt(receipt, token); err == nil {
		t.Fatal("expected a normal transfer not to count as a burn")
	}
}

func TestDecodeCreditBurnFromReceipt_IgnoresOtherContracts(t *testing.T) {
	burner := testAddr(0x01)
	// A burn of a different token must not retire EcoChain credits.
	receipt := testReceipt(testAddr(0x99), transferLog(burner, common.Address{}, 1_000_000_000_000_000_000))

	if _, err := decodeCreditBurnFromReceipt(receipt, testAddr(0x70)); err == nil {
		t.Fatal("expected a burn from another contract to be ignored")
	}
}

func TestDecodeCreditBurnFromReceipt_RejectsMalformedAmount(t *testing.T) {
	token := testAddr(0x70)
	bad := transferLog(testAddr(0x01), common.Address{}, 1)
	bad.Data = bad.Data[:16]
	receipt := testReceipt(token, bad)

	if _, err := decodeCreditBurnFromReceipt(receipt, token); err == nil {
		t.Fatal("expected malformed amount data to be rejected")
	}
}

func TestDecodeCreditBurnFromReceipt_RejectsZeroSender(t *testing.T) {
	token := testAddr(0x70)
	receipt := testReceipt(token, transferLog(common.Address{}, common.Address{}, 1))

	if _, err := decodeCreditBurnFromReceipt(receipt, token); err == nil {
		t.Fatal("expected a zero sender to be rejected")
	}
}

func TestDecodeCreditBurnFromReceipt_RejectsUnconfiguredToken(t *testing.T) {
	receipt := testReceipt(testAddr(0x70), transferLog(testAddr(0x01), common.Address{}, 1))

	if _, err := decodeCreditBurnFromReceipt(receipt, common.Address{}); err == nil {
		t.Fatal("expected an unconfigured token address to fail closed")
	}
}

func TestDecodeCreditBurn_RequiresConfiguredTokenAddress(t *testing.T) {
	t.Setenv("ECO_TOKEN", "")
	withReceipt(t, testReceipt(testAddr(0x70), transferLog(testAddr(0x01), common.Address{}, 1)))

	if _, err := DecodeCreditBurn("0xabc"); err == nil {
		t.Fatal("expected ECO_TOKEN to be required")
	}

	t.Setenv("ECO_TOKEN", "not-an-address")
	if _, err := DecodeCreditBurn("0xabc"); err == nil {
		t.Fatal("expected a malformed ECO_TOKEN to be rejected")
	}

	t.Setenv("ECO_TOKEN", testAddr(0x70).Hex())
	burn, err := DecodeCreditBurn("0xabc")
	if err != nil {
		t.Fatalf("expected the burn to decode once ECO_TOKEN is configured: %v", err)
	}
	if burn.Amount.Sign() <= 0 {
		t.Error("expected a positive amount")
	}
}

func TestValidateCreditBurn(t *testing.T) {
	wallet := testAddr(0x01)

	valid := &CreditBurn{From: wallet, Amount: big.NewInt(1_000_000_000_000_000_000)}

	cases := []struct {
		name    string
		burn    *CreditBurn
		wallet  string
		credits float64
		wantErr bool
	}{
		{"valid", valid, wallet.Hex(), 1, false},
		{"nil burn", nil, wallet.Hex(), 1, true},
		{"zero amount", &CreditBurn{From: wallet, Amount: big.NewInt(0)}, wallet.Hex(), 1, true},
		{"nil amount", &CreditBurn{From: wallet}, wallet.Hex(), 1, true},
		{"other wallet", valid, testAddr(0x02).Hex(), 1, true},
		{"empty wallet", valid, "", 1, true},
		{"amount too low", valid, wallet.Hex(), 2, true},
		{"amount too high", valid, wallet.Hex(), 0.5, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateCreditBurn(tc.burn, tc.wallet, tc.credits)
			if tc.wantErr && err == nil {
				t.Fatal("expected an error")
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

func TestCreditsToWei(t *testing.T) {
	cases := map[float64]string{
		1:     "1000000000000000000",
		0.5:   "500000000000000000",
		2.25:  "2250000000000000000",
		0.001: "1000000000000000",
	}
	for credits, want := range cases {
		if got := CreditsToWei(credits).String(); got != want {
			t.Errorf("CreditsToWei(%v) = %s, want %s", credits, got, want)
		}
	}
	if CreditsToWei(-1).Sign() != 0 {
		t.Error("expected a non-positive amount to convert to zero")
	}
}

// ─────────────────────────────────────────────────
// Small helpers and error paths
// ─────────────────────────────────────────────────

func TestTopicAt_OutOfRangeIsZero(t *testing.T) {
	if got := topicAt(&types.Log{}, 3); got != (common.Hash{}) {
		t.Errorf("expected a zero hash, got %s", got)
	}
}

func TestDecodeTreeCutConfirmed_MatchesConfiguredContract(t *testing.T) {
	t.Setenv("ECO_CHAIN_TREE", testAddr(0x55).Hex())
	log := cutConfirmedLog(7, testAddr(0x02))
	withReceipt(t, testReceipt(testAddr(0x55), log))

	event, err := DecodeTreeCutConfirmed("0xabc")
	if err != nil {
		t.Fatalf("expected the event to decode: %v", err)
	}
	if event.TokenId.Int64() != 7 {
		t.Errorf("expected token 7, got %s", event.TokenId)
	}

	withReceipt(t, testReceipt(testAddr(0x56), cutConfirmedLog(7, testAddr(0x02))))
	if _, err := DecodeTreeCutConfirmed("0xabc"); err == nil {
		t.Fatal("expected an event from another contract to be rejected")
	}
}

func TestVerifyTxSucceeded_RequiresRPCAndWellFormedHash(t *testing.T) {
	t.Setenv("RPC_URL", "")
	if err := VerifyTxSucceeded("0xabc"); !errors.Is(err, ErrRPCNotConfigured) {
		t.Fatalf("expected ErrRPCNotConfigured, got %v", err)
	}

	t.Setenv("RPC_URL", "https://example.invalid")
	err := VerifyTxSucceeded("0xnot-a-hash")
	if err == nil || !strings.Contains(err.Error(), "malformed") {
		t.Fatalf("expected a malformed-hash error, got %v", err)
	}
}

func TestEcoTokenAddress(t *testing.T) {
	t.Setenv("ECO_TOKEN", "")
	if _, err := ecoTokenAddress(); err == nil {
		t.Fatal("expected an error when ECO_TOKEN is empty")
	}
	t.Setenv("ECO_TOKEN", "0xzz")
	if _, err := ecoTokenAddress(); err == nil {
		t.Fatal("expected an error for an invalid address")
	}
	t.Setenv("ECO_TOKEN", "0x00000000000000000000000000000000000000aa")
	addr, err := ecoTokenAddress()
	if err != nil || addr.Hex() != "0x00000000000000000000000000000000000000AA" {
		t.Fatalf("expected the configured address, got %s (%v)", addr.Hex(), err)
	}
}

func TestWeiToFloat(t *testing.T) {
	if WeiToFloat(nil) != 0 || WeiToFloat(big.NewInt(0)) != 0 {
		t.Error("expected nil/zero to convert to 0")
	}
	if got := WeiToFloat(big.NewInt(1_000_000_000_000_000_000)); got != 1 {
		t.Errorf("expected 1 credit, got %v", got)
	}
	if got := WeiToFloat(big.NewInt(2_500_000_000_000_000_000)); got != 2.5 {
		t.Errorf("expected 2.5 credits, got %v", got)
	}
}

func TestNewBlockchainService_FailsWithoutRPC(t *testing.T) {
	t.Setenv("RPC_URL", "")
	if _, err := NewBlockchainService(); err == nil {
		t.Fatal("expected an error when RPC_URL is empty")
	}
}

func TestGetAuth_RejectsMalformedPrivateKey(t *testing.T) {
	service := &BlockchainService{ChainID: big.NewInt(11155111)}
	if _, err := service.GetAuth("not-a-key"); err == nil {
		t.Fatal("expected a malformed private key to be rejected")
	}
}
