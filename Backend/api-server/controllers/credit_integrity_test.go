package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"ecochain-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// setupIntegrityRouter builds a router whose auth middleware injects a real
// user id and wallet into the context, mirroring middleware.AuthMiddleware.
func setupIntegrityRouter(userID uuid.UUID, wallet string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("userID", userID.String())
		c.Set("walletAddress", wallet)
		c.Set("role", "verifier")
		c.Next()
	})
	return r
}

func postJSON(t *testing.T, r *gin.Engine, path string, body map[string]interface{}) *httptest.ResponseRecorder {
	t.Helper()
	raw, _ := json.Marshal(body)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", path, bytes.NewBuffer(raw))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	return w
}

func countCredits(t *testing.T, db *gorm.DB, treeID uuid.UUID, creditType string) int64 {
	t.Helper()
	var n int64
	db.Model(&models.CarbonCredit{}).
		Where("tree_id = ? AND type = ?", treeID, creditType).
		Count(&n)
	return n
}

// BurnCarbonCredits
// ─────────────────────────────────────────────────

func seedCredits(t *testing.T, db *gorm.DB, userID uuid.UUID, treeID uuid.UUID, amount float64) {
	t.Helper()
	if err := db.Create(&models.CarbonCredit{
		ID:        uuid.New(),
		UserID:    userID,
		TreeID:    treeID,
		Amount:    amount,
		Type:      "verification_reward",
		Tradeable: true,
		CreatedAt: time.Now(),
	}).Error; err != nil {
		t.Fatal("failed to seed credits:", err)
	}
}

func TestBurnCarbonCredits_Succeeds(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	userID := uuid.New()
	planter := createTestUser(t, db, "0xuser", "user")
	tree := createTestTree(t, db, planter.ID, "VERIFIED", "oak")
	seedCredits(t, db, userID, tree.ID, 10)

	r := setupIntegrityRouter(userID, "0xuser")
	r.POST("/api/credits/burn", BurnCarbonCredits)

	w := postJSON(t, r, "/api/credits/burn", map[string]interface{}{
		"amount":  4,
		"tx_hash": "0xburnhash1",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var net float64
	db.Model(&models.CarbonCredit{}).Where("user_id = ?", userID).
		Select("COALESCE(SUM(amount), 0)").Scan(&net)
	if net != 6 {
		t.Errorf("expected a net ledger balance of 6, got %v", net)
	}
}

func TestBurnCarbonCredits_SameTxHashTwiceReturns409(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	userID := uuid.New()
	planter := createTestUser(t, db, "0xuser", "user")
	tree := createTestTree(t, db, planter.ID, "VERIFIED", "oak")
	seedCredits(t, db, userID, tree.ID, 10)

	r := setupIntegrityRouter(userID, "0xuser")
	r.POST("/api/credits/burn", BurnCarbonCredits)

	first := postJSON(t, r, "/api/credits/burn", map[string]interface{}{
		"amount":  4,
		"tx_hash": "0xreplayedburn",
	})
	if first.Code != http.StatusOK {
		t.Fatalf("expected 200 on the first burn, got %d: %s", first.Code, first.Body.String())
	}

	second := postJSON(t, r, "/api/credits/burn", map[string]interface{}{
		"amount":  4,
		"tx_hash": "0xreplayedburn",
	})
	if second.Code != http.StatusConflict {
		t.Fatalf("expected 409 for a replayed tx_hash, got %d: %s", second.Code, second.Body.String())
	}

	// The balance must only have moved once.
	var net float64
	db.Model(&models.CarbonCredit{}).Where("user_id = ?", userID).
		Select("COALESCE(SUM(amount), 0)").Scan(&net)
	if net != 6 {
		t.Errorf("expected a net ledger balance of 6 after one burn, got %v", net)
	}

	var burns int64
	db.Model(&models.CarbonCredit{}).Where("user_id = ? AND type = ?", userID, "burned").Count(&burns)
	if burns != 1 {
		t.Errorf("expected exactly 1 burn row, got %d", burns)
	}
}

func TestBurnCarbonCredits_RejectsBurningMoreThanTheLedgerBalance(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	userID := uuid.New()
	planter := createTestUser(t, db, "0xuser", "user")
	tree := createTestTree(t, db, planter.ID, "VERIFIED", "oak")
	seedCredits(t, db, userID, tree.ID, 5)

	r := setupIntegrityRouter(userID, "0xuser")
	r.POST("/api/credits/burn", BurnCarbonCredits)

	w := postJSON(t, r, "/api/credits/burn", map[string]interface{}{
		"amount":  6,
		"tx_hash": "0xtoobig",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when burning more than the balance, got %d: %s", w.Code, w.Body.String())
	}

	var burns int64
	db.Model(&models.CarbonCredit{}).Where("user_id = ? AND type = ?", userID, "burned").Count(&burns)
	if burns != 0 {
		t.Errorf("expected no burn rows, got %d", burns)
	}
}

func TestBurnCarbonCredits_CannotBurnTheSameCreditsTwiceWithDifferentHashes(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	userID := uuid.New()
	planter := createTestUser(t, db, "0xuser", "user")
	tree := createTestTree(t, db, planter.ID, "VERIFIED", "oak")
	seedCredits(t, db, userID, tree.ID, 5)

	r := setupIntegrityRouter(userID, "0xuser")
	r.POST("/api/credits/burn", BurnCarbonCredits)

	first := postJSON(t, r, "/api/credits/burn", map[string]interface{}{
		"amount":  5,
		"tx_hash": "0xburnA",
	})
	if first.Code != http.StatusOK {
		t.Fatalf("expected 200 on the first burn, got %d: %s", first.Code, first.Body.String())
	}

	// A different hash must not allow the same credits to be burned again:
	// the balance is derived from the full signed ledger.
	second := postJSON(t, r, "/api/credits/burn", map[string]interface{}{
		"amount":  5,
		"tx_hash": "0xburnB",
	})
	if second.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when the ledger balance is exhausted, got %d: %s", second.Code, second.Body.String())
	}

	var net float64
	db.Model(&models.CarbonCredit{}).Where("user_id = ?", userID).
		Select("COALESCE(SUM(amount), 0)").Scan(&net)
	if net != 0 {
		t.Errorf("expected a net ledger balance of 0, got %v", net)
	}
}

func TestBurnCarbonCredits_RequiresTxHash(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	userID := uuid.New()
	planter := createTestUser(t, db, "0xuser", "user")
	tree := createTestTree(t, db, planter.ID, "VERIFIED", "oak")
	seedCredits(t, db, userID, tree.ID, 5)

	r := setupIntegrityRouter(userID, "0xuser")
	r.POST("/api/credits/burn", BurnCarbonCredits)

	w := postJSON(t, r, "/api/credits/burn", map[string]interface{}{
		"amount": 1,
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when tx_hash is missing, got %d: %s", w.Code, w.Body.String())
	}
}

// ─────────────────────────────────────────────────
// Integrity indexes
// ─────────────────────────────────────────────────

func TestIntegrityIndexesAreUniqueAndPresent(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	expected := map[string]string{
		"uni_marketplace_transactions_tx_hash": "marketplace_transactions",
		"uni_carbon_credits_tree_id_type":      "carbon_credits",
		"uni_carbon_credits_transaction_hash":  "carbon_credits",
		"uni_replacement_trees_tree_id":        "replacement_trees",
		"uni_trees_blockchain_token_id":        "trees",
	}

	for name, table := range expected {
		var sql string
		err := db.Raw(`SELECT sql FROM sqlite_master WHERE type='index' AND name = ?`, name).
			Scan(&sql).Error
		if err != nil {
			t.Fatalf("failed to look up index %s: %v", name, err)
		}
		if sql == "" {
			t.Errorf("expected index %s to exist on %s", name, table)
			continue
		}
		if !contains(sql, "UNIQUE") {
			t.Errorf("expected index %s to be UNIQUE, got: %s", name, sql)
		}
	}

	// Regression: the composite index name was once applied only to
	// carbon_credits.type, producing a single-column unique index that allowed
	// one verification_reward per table instead of one per tree.
	var carbonIndex string
	db.Raw(`SELECT sql FROM sqlite_master WHERE type='index' AND name = 'uni_carbon_credits_tree_id_type'`).
		Scan(&carbonIndex)
	if !contains(carbonIndex, "tree_id") {
		t.Errorf("the carbon credit uniqueness index must cover tree_id, got: %s", carbonIndex)
	}
}

func TestUniqueConstraintAllowsTheSameCreditTypeForDifferentTrees(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	planter := createTestUser(t, db, "0xplanter", "user")
	first := createTestTree(t, db, planter.ID, "VERIFIED", "oak")
	second := createTestTree(t, db, planter.ID, "VERIFIED", "pine")

	for _, tree := range []models.Tree{first, second} {
		if err := db.Create(&models.CarbonCredit{
			ID: uuid.New(), UserID: planter.ID, TreeID: tree.ID, Amount: 1,
			Type: "verification_reward", Tradeable: true, CreatedAt: time.Now(),
		}).Error; err != nil {
			t.Fatalf("expected a credit for tree %s to be accepted: %v", tree.TreeID, err)
		}
	}

	var count int64
	db.Model(&models.CarbonCredit{}).Where("type = ?", "verification_reward").Count(&count)
	if count != 2 {
		t.Errorf("expected 2 verification rewards, got %d", count)
	}
}

func TestUniqueConstraintRejectsTwoCreditsForTheSameTree(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	userID := uuid.New()
	planter := createTestUser(t, db, "0xplanter", "user")
	tree := createTestTree(t, db, planter.ID, "PENDING_VERIFICATION", "oak")

	first := models.CarbonCredit{
		ID: uuid.New(), UserID: userID, TreeID: tree.ID, Amount: 1,
		Type: "verification_reward", Tradeable: true, CreatedAt: time.Now(),
	}
	if err := db.Create(&first).Error; err != nil {
		t.Fatalf("failed to create the first credit: %v", err)
	}

	second := first
	second.ID = uuid.New()
	err := db.Create(&second).Error
	if err == nil {
		t.Fatal("expected the database to reject a second credit for the same tree and type")
	}
	if !isUniqueViolation(err) {
		t.Errorf("expected a unique violation, got %v", err)
	}
}

func TestUniqueConstraintRejectsOneTreeClearingTwoDebts(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	debtA := uuid.New()
	debtB := uuid.New()
	link := models.ReplacementTree{
		ID: uuid.New(), DebtID: debtA, TreeID: "TREE-SHARED", LinkedAt: time.Now(),
	}
	if err := db.Create(&link).Error; err != nil {
		t.Fatalf("failed to create the first replacement link: %v", err)
	}

	other := link
	other.ID = uuid.New()
	other.DebtID = debtB
	err := db.Create(&other).Error
	if err == nil {
		t.Fatal("expected the database to reject the same tree being linked to a second debt")
	}
	if !isUniqueViolation(err) {
		t.Errorf("expected a unique violation, got %v", err)
	}
}

func TestUniqueConstraintRejectsTwoTreesClaimingTheSameOnChainToken(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	planter := createTestUser(t, db, "0xplanter", "user")

	first := createTestTree(t, db, planter.ID, "PENDING_VERIFICATION", "oak")
	db.Model(&models.Tree{}).Where("id = ?", first.ID).Update("blockchain_token_id", "42")

	second := createTestTree(t, db, planter.ID, "PENDING_VERIFICATION", "pine")
	err := db.Model(&models.Tree{}).Where("id = ?", second.ID).Update("blockchain_token_id", "42").Error
	if err == nil {
		t.Fatal("expected the database to reject two trees claiming the same on-chain token id")
	}
	if !isUniqueViolation(err) {
		t.Errorf("expected a unique violation, got %v", err)
	}
}

func contains(haystack, needle string) bool {
	for i := 0; i+len(needle) <= len(haystack); i++ {
		if haystack[i:i+len(needle)] == needle {
			return true
		}
	}
	return false
}

var _ = fmt.Sprintf
