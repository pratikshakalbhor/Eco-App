package services

import (
	"math/big"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

func testAddr(n byte) common.Address {
	a := common.Address{}
	a[19] = n
	return a
}

func topicAddr(a common.Address) common.Hash { return common.BytesToHash(a.Bytes()) }
func topicUint(n int64) common.Hash          { return common.BigToHash(big.NewInt(n)) }
func word(n int64) []byte                    { return common.BigToHash(big.NewInt(n)).Bytes() }
func wordAddr(a common.Address) []byte       { return common.BytesToHash(a.Bytes()).Bytes() }

func testReceipt(address common.Address, logs ...*types.Log) *types.Receipt {
	for _, log := range logs {
		log.Address = address
	}
	return &types.Receipt{Status: 1, Logs: logs}
}

func withReceipt(t *testing.T, receipt *types.Receipt) {
	t.Helper()
	original := receiptFetcher
	receiptFetcher = func(string) (*types.Receipt, error) { return receipt, nil }
	t.Cleanup(func() { receiptFetcher = original })
}

func creditsMintedLog(tokenID, amount int64, planter common.Address) *types.Log {
	return &types.Log{
		Topics: []common.Hash{
			EcoChainTreeABI.Events["CreditsMinted"].ID,
			topicUint(tokenID),
			topicAddr(planter),
		},
		Data: word(amount),
	}
}

func cutConfirmedLog(tokenID int64, verifier common.Address) *types.Log {
	return &types.Log{
		Topics: []common.Hash{
			EcoChainTreeABI.Events["TreeCutConfirmed"].ID,
			topicUint(tokenID),
			topicAddr(verifier),
		},
	}
}

func debtCreatedLog(debtID, originalTokenID int64, debtor common.Address, replacements uint16) *types.Log {
	data := append(wordAddr(debtor), word(int64(replacements))...)
	return &types.Log{
		Topics: []common.Hash{debtCreatedTopic(), topicUint(debtID), topicUint(originalTokenID)},
		Data:   data,
	}
}

func frozenLog(account common.Address) *types.Log {
	return &types.Log{Topics: []common.Hash{frozenTopic(), topicAddr(account)}}
}

func replantedLog(replacementTokenID, originalTokenID int64) *types.Log {
	return &types.Log{
		Topics: []common.Hash{
			EcoChainTreeABI.Events["TreeReplanted"].ID,
			topicUint(replacementTokenID),
			topicUint(originalTokenID),
		},
	}
}

// ─────────────────────────────────────────────────
// CreditsMinted
// ─────────────────────────────────────────────────

func TestDecodeCreditsMinted_DecodesIndexedTopicsAndAmount(t *testing.T) {
	contract := testAddr(0xAA)
	planter := testAddr(0x01)
	t.Setenv("ECO_CHAIN_TREE", contract.Hex())
	withReceipt(t, testReceipt(contract, creditsMintedLog(7, 1500, planter)))

	event, err := DecodeCreditsMinted(strings.Repeat("ab", 32))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if event.TokenId.Int64() != 7 {
		t.Errorf("expected token 7, got %s", event.TokenId)
	}
	if !strings.EqualFold(event.Planter.Hex(), planter.Hex()) {
		t.Errorf("expected planter %s, got %s", planter, event.Planter)
	}
	if event.Amount.Int64() != 1500 {
		t.Errorf("expected 1500, got %s", event.Amount)
	}
}

func TestDecodeCreditsMinted_RejectsMissingEvent(t *testing.T) {
	contract := testAddr(0xAA)
	t.Setenv("ECO_CHAIN_TREE", contract.Hex())
	withReceipt(t, testReceipt(contract, replantedLog(1, 2)))

	if _, err := DecodeCreditsMinted(strings.Repeat("ab", 32)); err == nil {
		t.Fatal("expected an error when the receipt has no CreditsMinted event")
	}
}

func TestDecodeCreditsMinted_IgnoresEventFromAnotherContract(t *testing.T) {
	contract := testAddr(0xAA)
	other := testAddr(0xBB)
	t.Setenv("ECO_CHAIN_TREE", contract.Hex())
	// A forged contract emitting the same event must be ignored.
	withReceipt(t, testReceipt(other, creditsMintedLog(7, 1500, testAddr(0x01))))

	if _, err := DecodeCreditsMinted(strings.Repeat("ab", 32)); err == nil {
		t.Fatal("expected the forged event from another address to be ignored")
	}
}

func TestValidateCreditsMinted_RejectsWrongTokenId(t *testing.T) {
	event := &CreditsMintedEvent{TokenId: big.NewInt(8), Planter: testAddr(1), Amount: big.NewInt(100)}
	if err := ValidateCreditsMinted(event, "7", testAddr(1).Hex()); err == nil {
		t.Fatal("expected a wrong token id to be rejected")
	}
}

func TestValidateCreditsMinted_RejectsWrongPlanter(t *testing.T) {
	event := &CreditsMintedEvent{TokenId: big.NewInt(7), Planter: testAddr(2), Amount: big.NewInt(100)}
	if err := ValidateCreditsMinted(event, "7", testAddr(1).Hex()); err == nil {
		t.Fatal("expected a wrong planter to be rejected")
	}
}

func TestValidateCreditsMinted_RejectsZeroAmount(t *testing.T) {
	event := &CreditsMintedEvent{TokenId: big.NewInt(7), Planter: testAddr(1), Amount: big.NewInt(0)}
	if err := ValidateCreditsMinted(event, "7", testAddr(1).Hex()); err == nil {
		t.Fatal("expected a zero amount to be rejected")
	}
}

func TestValidateCreditsMinted_AcceptsMatchingEvent(t *testing.T) {
	event := &CreditsMintedEvent{TokenId: big.NewInt(7), Planter: testAddr(1), Amount: big.NewInt(100)}
	if err := ValidateCreditsMinted(event, "7", strings.ToLower(testAddr(1).Hex())); err != nil {
		t.Fatalf("expected a matching event to be accepted, got %v", err)
	}
}

// ─────────────────────────────────────────────────
// Cut settlement (TreeCutConfirmed + DebtCreated + Frozen)
// ─────────────────────────────────────────────────

func TestDecodeCutSettlement_RequiresAllThreeEvents(t *testing.T) {
	contract := testAddr(0xAA)
	debtor := testAddr(3)
	t.Setenv("ECO_CHAIN_TREE", contract.Hex())

	full := testReceipt(contract,
		cutConfirmedLog(5, testAddr(9)),
		debtCreatedLog(1, 5, debtor, 3),
		frozenLog(debtor),
	)
	withReceipt(t, full)

	settlement, err := DecodeCutSettlement(strings.Repeat("ab", 32))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if settlement.Confirmed.TokenId.Int64() != 5 {
		t.Errorf("expected token 5, got %s", settlement.Confirmed.TokenId)
	}
	if settlement.Debt.Debtor != debtor {
		t.Errorf("expected debtor %s, got %s", debtor, settlement.Debt.Debtor)
	}
	if settlement.Debt.ReplacementsNeeded != 3 {
		t.Errorf("expected 3 replacements, got %d", settlement.Debt.ReplacementsNeeded)
	}
	if !settlement.Frozen || settlement.FrozenAccount != debtor {
		t.Errorf("expected the debtor to be frozen, got %+v", settlement)
	}

	noDebt := testReceipt(contract, cutConfirmedLog(5, testAddr(9)), frozenLog(debtor))
	withReceipt(t, noDebt)
	if _, err := DecodeCutSettlement(strings.Repeat("ab", 32)); err == nil {
		t.Fatal("expected an error when DebtCreated is missing")
	}

	noFreeze := testReceipt(contract, cutConfirmedLog(5, testAddr(9)), debtCreatedLog(1, 5, debtor, 3))
	withReceipt(t, noFreeze)
	if _, err := DecodeCutSettlement(strings.Repeat("ab", 32)); err == nil {
		t.Fatal("expected an error when Frozen is missing")
	}
}

func TestDecodeCutSettlement_RejectsDebtForAnotherTree(t *testing.T) {
	contract := testAddr(0xAA)
	debtor := testAddr(3)
	t.Setenv("ECO_CHAIN_TREE", contract.Hex())
	withReceipt(t, testReceipt(contract,
		cutConfirmedLog(5, testAddr(9)),
		debtCreatedLog(1, 6, debtor, 3),
		frozenLog(debtor),
	))

	if _, err := DecodeCutSettlement(strings.Repeat("ab", 32)); err == nil {
		t.Fatal("expected an error when the debt is for a different tree")
	}
}

func TestDecodeCutSettlement_RejectsFreezeOnAnotherAccount(t *testing.T) {
	contract := testAddr(0xAA)
	debtor := testAddr(3)
	t.Setenv("ECO_CHAIN_TREE", contract.Hex())
	withReceipt(t, testReceipt(contract,
		cutConfirmedLog(5, testAddr(9)),
		debtCreatedLog(1, 5, debtor, 3),
		frozenLog(testAddr(4)),
	))

	if _, err := DecodeCutSettlement(strings.Repeat("ab", 32)); err == nil {
		t.Fatal("expected an error when the freeze targets a different account")
	}
}

func TestValidateCutSettlement_RejectsWrongOwner(t *testing.T) {
	settlement := &CutSettlement{
		Confirmed:     TreeCutConfirmedEvent{TokenId: big.NewInt(5)},
		Debt:          DebtCreatedEvent{OriginalTokenId: big.NewInt(5), Debtor: testAddr(3)},
		Frozen:        true,
		FrozenAccount: testAddr(3),
	}
	if err := ValidateCutSettlement(settlement, "5", testAddr(4).Hex()); err == nil {
		t.Fatal("expected a settlement for another owner to be rejected")
	}
	if err := ValidateCutSettlement(settlement, "5", testAddr(3).Hex()); err != nil {
		t.Fatalf("expected a matching settlement to be accepted, got %v", err)
	}
	if err := ValidateCutSettlement(settlement, "6", testAddr(3).Hex()); err == nil {
		t.Fatal("expected a settlement for another tree to be rejected")
	}
}

// ─────────────────────────────────────────────────
// Replantation
// ─────────────────────────────────────────────────

func TestDecodeTreeReplanted_DecodesIndexedTopics(t *testing.T) {
	contract := testAddr(0xAA)
	t.Setenv("ECO_CHAIN_TREE", contract.Hex())
	withReceipt(t, testReceipt(contract, replantedLog(11, 5)))

	event, err := DecodeTreeReplanted(strings.Repeat("ab", 32))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if event.ReplacementTokenId.Int64() != 11 || event.OriginalTokenId.Int64() != 5 {
		t.Fatalf("unexpected decoded event: %+v", event)
	}
}

func TestValidateReplantation_RejectsMismatch(t *testing.T) {
	event := &TreeReplantedEvent{ReplacementTokenId: big.NewInt(11), OriginalTokenId: big.NewInt(5)}

	if err := ValidateReplantation(event, "12", "5"); err == nil {
		t.Fatal("expected a wrong replacement token to be rejected")
	}
	if err := ValidateReplantation(event, "11", "6"); err == nil {
		t.Fatal("expected a wrong original token to be rejected")
	}
	if err := ValidateReplantation(event, "11", "5"); err != nil {
		t.Fatalf("expected a matching event to be accepted, got %v", err)
	}
}

func TestDecodeTreeReplanted_RejectsMissingEvent(t *testing.T) {
	contract := testAddr(0xAA)
	t.Setenv("ECO_CHAIN_TREE", contract.Hex())
	withReceipt(t, testReceipt(contract, creditsMintedLog(7, 1500, testAddr(1))))

	if _, err := DecodeTreeReplanted(strings.Repeat("ab", 32)); err == nil {
		t.Fatal("expected an error when the receipt has no TreeReplanted event")
	}
}
