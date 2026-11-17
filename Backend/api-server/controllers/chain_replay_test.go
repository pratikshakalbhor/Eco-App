package controllers

import (
	"errors"
	"math/big"
	"net/http"
	"testing"

	"ecochain-backend/models"
	"ecochain-backend/services"

	"github.com/ethereum/go-ethereum/common"
	"github.com/google/uuid"
)

// stubCreditsDecoder replaces the chain decoder for the duration of a test.
func stubCreditsDecoder(t *testing.T, fn func(txHash string) (*services.CreditsMintedEvent, error)) {
	t.Helper()
	original := services.CreditsMintedDecoder
	services.CreditsMintedDecoder = fn
	t.Cleanup(func() { services.CreditsMintedDecoder = original })
}

const testOwner = "0x00000000000000000000000000000000000000aa"

const testTxHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

func TestVerifyTree_RejectsWrongTokenIdFromChain(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "https://example.invalid")
	db := setupTestDB(t)

	planter := createTestUser(t, db, "0xplanter", "user")
	tree := createTestTree(t, db, planter.ID, "PENDING_VERIFICATION", "oak")
	tree.BlockchainTokenID = "7"
	tree.OwnerWallet = testOwner
	if err := db.Save(&tree).Error; err != nil {
		t.Fatal(err)
	}

	stubCreditsDecoder(t, func(string) (*services.CreditsMintedEvent, error) {
		return &services.CreditsMintedEvent{
			TokenId: big.NewInt(8), // not this tree
			Planter: common.HexToAddress(testOwner),
			Amount:  big.NewInt(1_000_000_000_000_000_000),
		}, nil
	})

	r := setupIntegrityRouter(uuid.New(), "0xverifier")
	r.POST("/api/trees/:id/verify", VerifyTree)

	w := postJSON(t, r, "/api/trees/"+tree.ID.String()+"/verify", map[string]interface{}{
		"status":  "VERIFIED",
		"tx_hash": testTxHash,
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for a wrong token id, got %d: %s", w.Code, w.Body.String())
	}
	if n := countCredits(t, db, tree.ID, "verification_reward"); n != 0 {
		t.Fatalf("expected no credit to be issued, got %d rows", n)
	}
}

func TestVerifyTree_RejectsWrongPlanterFromChain(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "https://example.invalid")
	db := setupTestDB(t)

	planter := createTestUser(t, db, "0xplanter", "user")
	tree := createTestTree(t, db, planter.ID, "PENDING_VERIFICATION", "oak")
	tree.BlockchainTokenID = "7"
	tree.OwnerWallet = testOwner
	if err := db.Save(&tree).Error; err != nil {
		t.Fatal(err)
	}

	stubCreditsDecoder(t, func(string) (*services.CreditsMintedEvent, error) {
		return &services.CreditsMintedEvent{
			TokenId: big.NewInt(7),
			Planter: common.HexToAddress("0x000000000000000000000000000000000000dEaD"), // not the owner
			Amount:  big.NewInt(1_000_000_000_000_000_000),
		}, nil
	})

	r := setupIntegrityRouter(uuid.New(), "0xverifier")
	r.POST("/api/trees/:id/verify", VerifyTree)

	w := postJSON(t, r, "/api/trees/"+tree.ID.String()+"/verify", map[string]interface{}{
		"status":  "VERIFIED",
		"tx_hash": testTxHash,
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for a wrong planter, got %d: %s", w.Code, w.Body.String())
	}
	if n := countCredits(t, db, tree.ID, "verification_reward"); n != 0 {
		t.Fatalf("expected no credit to be issued, got %d rows", n)
	}
}

func TestVerifyTree_RejectsMissingEvent(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "https://example.invalid")
	db := setupTestDB(t)

	planter := createTestUser(t, db, "0xplanter", "user")
	tree := createTestTree(t, db, planter.ID, "PENDING_VERIFICATION", "oak")
	tree.BlockchainTokenID = "7"
	tree.OwnerWallet = testOwner
	if err := db.Save(&tree).Error; err != nil {
		t.Fatal(err)
	}

	stubCreditsDecoder(t, func(string) (*services.CreditsMintedEvent, error) {
		return nil, errors.New("CreditsMinted event not found in transaction")
	})

	r := setupIntegrityRouter(uuid.New(), "0xverifier")
	r.POST("/api/trees/:id/verify", VerifyTree)

	w := postJSON(t, r, "/api/trees/"+tree.ID.String()+"/verify", map[string]interface{}{
		"status":  "VERIFIED",
		"tx_hash": testTxHash,
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when the event is missing, got %d: %s", w.Code, w.Body.String())
	}
	if n := countCredits(t, db, tree.ID, "verification_reward"); n != 0 {
		t.Fatalf("expected no credit to be issued, got %d rows", n)
	}
}

// TestVerifyTree_RejectsReplayedTxHash proves one transaction can back at most
// one credit issuance: the carbon_credits.transaction_hash unique index turns
// a replay for a second tree into a 409 instead of a second credit row.
func TestVerifyTree_RejectsReplayedTxHash(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "https://example.invalid")
	db := setupTestDB(t)

	planter := createTestUser(t, db, "0xplanter", "user")

	treeA := createTestTree(t, db, planter.ID, "PENDING_VERIFICATION", "oak")
	treeA.BlockchainTokenID = "1"
	treeA.OwnerWallet = testOwner
	if err := db.Save(&treeA).Error; err != nil {
		t.Fatal(err)
	}
	treeB := createTestTree(t, db, planter.ID, "PENDING_VERIFICATION", "pine")
	treeB.BlockchainTokenID = "2"
	treeB.OwnerWallet = testOwner
	if err := db.Save(&treeB).Error; err != nil {
		t.Fatal(err)
	}

	// The same tx hash is claimed for both trees. Each call returns an event
	// naming the tree being verified, so only the replay guard can catch it.
	call := 0
	stubCreditsDecoder(t, func(string) (*services.CreditsMintedEvent, error) {
		call++
		return &services.CreditsMintedEvent{
			TokenId: big.NewInt(int64(call)),
			Planter: common.HexToAddress(testOwner),
			Amount:  big.NewInt(1_000_000_000_000_000_000),
		}, nil
	})

	r := setupIntegrityRouter(uuid.New(), "0xverifier")
	r.POST("/api/trees/:id/verify", VerifyTree)

	first := postJSON(t, r, "/api/trees/"+treeA.ID.String()+"/verify", map[string]interface{}{
		"status":  "VERIFIED",
		"tx_hash": testTxHash,
	})
	if first.Code != http.StatusOK {
		t.Fatalf("expected 200 for the first verification, got %d: %s", first.Code, first.Body.String())
	}

	second := postJSON(t, r, "/api/trees/"+treeB.ID.String()+"/verify", map[string]interface{}{
		"status":  "VERIFIED",
		"tx_hash": testTxHash,
	})
	if second.Code != http.StatusConflict {
		t.Fatalf("expected 409 for a replayed tx hash, got %d: %s", second.Code, second.Body.String())
	}

	var credited int64
	db.Model(&models.CarbonCredit{}).Where("transaction_hash = ?", testTxHash).Count(&credited)
	if credited != 1 {
		t.Fatalf("expected exactly 1 credit row for the tx hash, got %d", credited)
	}
}
