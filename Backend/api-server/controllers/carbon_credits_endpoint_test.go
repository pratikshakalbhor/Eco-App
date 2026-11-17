package controllers

import (
	"bytes"
	"encoding/json"
	"errors"
	"math"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"ecochain-backend/models"
	"ecochain-backend/services"

	"github.com/ethereum/go-ethereum/common"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// postJSONTo sends a request with an optional JSON body, used for GET routes
// that still need to go through the router stack.
func postJSONTo(t *testing.T, r *gin.Engine, method, path string, body interface{}) *httptest.ResponseRecorder {
	t.Helper()
	var buf *bytes.Buffer
	if body != nil {
		raw, _ := json.Marshal(body)
		buf = bytes.NewBuffer(raw)
	} else {
		buf = bytes.NewBuffer(nil)
	}
	w := httptest.NewRecorder()
	req := httptest.NewRequest(method, path, buf)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	r.ServeHTTP(w, req)
	return w
}

// ─────────────────────────────────────────────────
// GetUserCarbonCredits
// ─────────────────────────────────────────────────

type carbonCreditsResponse struct {
	CarbonBalance        float64 `json:"carbon_balance"`
	CreditsEarned        float64 `json:"credits_earned"`
	CreditsLost          float64 `json:"credits_lost"`
	EnvironmentalDebt    float64 `json:"environmental_debt"`
	CompensationRequired bool    `json:"compensation_required"`
	ActiveTrees          int     `json:"active_trees"`
	CutTrees             int     `json:"cut_trees"`
	ReplacementTrees     int     `json:"replacement_trees"`
	CO2Stats             struct {
		TotalAbsorbed float64 `json:"total_absorbed"`
	} `json:"co2_stats"`
	OxygenStats struct {
		TotalGenerated float64 `json:"total_generated"`
	} `json:"oxygen_stats"`
	SustainabilityScore float64 `json:"sustainability_score"`
}

func TestGetUserCarbonCredits_AggregatesSignedLedgerAndTrees(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	user := createTestUser(t, db, "0xcredits", "user")
	now := time.Now()

	// Verified tree, exactly one year old, 20 kg/year.
	verified := models.Tree{
		ID: uuid.New(), TreeID: "TREE-CRED-1", PlanterID: user.ID,
		Species: "oak", OwnerWallet: user.WalletAddress, Status: "VERIFIED",
		CarbonAbsorptionRate: 20, PlantedAt: now.AddDate(-1, 0, 0),
	}
	// Cut tree + cut report + loss.
	cut := models.Tree{
		ID: uuid.New(), TreeID: "TREE-CRED-2", PlanterID: user.ID,
		Species: "pine", OwnerWallet: user.WalletAddress, Status: "CUT_CONFIRMED",
		CarbonAbsorptionRate: 18, PlantedAt: now.AddDate(-2, 0, 0),
	}
	// A replacement tree awaiting verification: it counts as a replacement but
	// not as an active tree, so it must not add absorption.
	replacement := models.Tree{
		ID: uuid.New(), TreeID: "TREE-CRED-3", PlanterID: user.ID,
		Species: "maple", OwnerWallet: user.WalletAddress, Status: "PENDING_VERIFICATION",
		CarbonAbsorptionRate: 24, PlantedAt: now.AddDate(-1, 0, 0),
		IsReplacement: true,
	}
	for _, tree := range []*models.Tree{&verified, &cut, &replacement} {
		if err := db.Create(tree).Error; err != nil {
			t.Fatal(err)
		}
	}

	db.Create(&models.CarbonCredit{ID: uuid.New(), UserID: user.ID, TreeID: verified.ID, Amount: 2.5, Type: "verification_reward", TransactionHash: "0xcredit1"})
	db.Create(&models.CarbonCredit{ID: uuid.New(), UserID: user.ID, TreeID: uuid.Nil, Amount: -1, Type: "burned", TransactionHash: "0xcredit2"})

	db.Create(&models.CutReport{
		ID: uuid.New(), TreeID: cut.TreeID, OwnerWallet: user.WalletAddress,
		Reason: "Storm", CutDate: now.AddDate(0, -1, 0), Status: "CONFIRMED", CreatedAt: now,
	})
	db.Create(&models.EnvironmentalLoss{
		ID: uuid.New(), TreeID: cut.TreeID, CO2LostKg: 500,
		CalculatedAt: now,
	})
	db.Create(&models.ReplantationDebt{
		ID: uuid.New(), OriginalTreeID: cut.TreeID, OwnerWallet: user.WalletAddress,
		TreesNeeded: 3, Status: "PENDING", CreatedAt: now, UpdatedAt: now,
	})

	r := setupIntegrityRouter(user.ID, user.WalletAddress)
	r.GET("/api/credits", GetUserCarbonCredits)

	w := postJSONTo(t, r, "GET", "/api/credits", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var got carbonCreditsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal("failed to decode response:", err)
	}

	if got.CarbonBalance != 1.5 {
		t.Errorf("expected a net ledger balance of 1.5, got %v", got.CarbonBalance)
	}
	if got.CreditsEarned != 2.5 {
		t.Errorf("expected 2.5 credits earned, got %v", got.CreditsEarned)
	}
	if got.CreditsLost != 1.0 {
		t.Errorf("expected 1 credit lost, got %v", got.CreditsLost)
	}
	if got.ActiveTrees != 1 {
		t.Errorf("expected 1 active tree, got %d", got.ActiveTrees)
	}
	if got.CutTrees != 1 {
		t.Errorf("expected 1 cut tree, got %d", got.CutTrees)
	}
	if got.ReplacementTrees != 1 {
		t.Errorf("expected 1 replacement tree, got %d", got.ReplacementTrees)
	}
	if got.EnvironmentalDebt != 500 {
		t.Errorf("expected 500 kg of environmental debt, got %v", got.EnvironmentalDebt)
	}
	if !got.CompensationRequired {
		t.Error("expected compensation to be required while the debt is open")
	}
	if math.Abs(got.CO2Stats.TotalAbsorbed-20) > 1 {
		t.Errorf("expected roughly 20 kg absorbed, got %v", got.CO2Stats.TotalAbsorbed)
	}
	if math.Abs(got.OxygenStats.TotalGenerated-20*services.OxygenToCarbonMassRatio) > 1 {
		t.Errorf("expected oxygen to use the shared mass ratio, got %v", got.OxygenStats.TotalGenerated)
	}
	if got.SustainabilityScore <= 0 || got.SustainabilityScore > 100 {
		t.Errorf("expected a sustainability score in (0, 100], got %v", got.SustainabilityScore)
	}
}

func TestGetUserCarbonCredits_EmptyUserHasZeroBalance(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xempty", "user")

	r := setupIntegrityRouter(user.ID, user.WalletAddress)
	r.GET("/api/credits", GetUserCarbonCredits)

	w := postJSONTo(t, r, "GET", "/api/credits", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var got carbonCreditsResponse
	json.Unmarshal(w.Body.Bytes(), &got)
	if got.CarbonBalance != 0 || got.CompensationRequired {
		t.Errorf("expected an empty account, got %+v", got)
	}
}

// ─────────────────────────────────────────────────
// BurnCarbonCredits
// ─────────────────────────────────────────────────

func stubBurnDecoder(t *testing.T, fn func(txHash string) (*services.CreditBurn, error)) {
	t.Helper()
	original := services.CreditBurnDecoder
	services.CreditBurnDecoder = fn
	t.Cleanup(func() { services.CreditBurnDecoder = original })
}

func seedBurnableCredits(t *testing.T, db *gorm.DB, user models.User, amount float64, tradeable bool) {
	t.Helper()
	if err := db.Create(&models.CarbonCredit{
		ID: uuid.New(), UserID: user.ID, TreeID: uuid.New(),
		Amount: amount, Tradeable: tradeable, Type: "verification_reward",
		TransactionHash: "0xseed-" + uuid.New().String(),
	}).Error; err != nil {
		t.Fatal(err)
	}
}

func TestBurnCarbonCredits_RecordsNegativeLedgerEntry(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xburner", "user")
	seedBurnableCredits(t, db, user, 5, true)

	r := setupIntegrityRouter(user.ID, user.WalletAddress)
	r.POST("/api/credits/burn", BurnCarbonCredits)

	w := postJSON(t, r, "/api/credits/burn", map[string]interface{}{
		"amount":  2.0,
		"tx_hash": testTxHash,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var burned models.CarbonCredit
	if err := db.First(&burned, "type = ? AND user_id = ?", "burned", user.ID).Error; err != nil {
		t.Fatal("expected a burn row:", err)
	}
	if burned.Amount != -2 {
		t.Errorf("expected -2 credits, got %v", burned.Amount)
	}
	if burned.Tradeable {
		t.Error("a burned row must not be tradeable")
	}
}

func TestBurnCarbonCredits_RejectsInsufficientBalance(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xburner", "user")
	seedBurnableCredits(t, db, user, 1, true)

	r := setupIntegrityRouter(user.ID, user.WalletAddress)
	r.POST("/api/credits/burn", BurnCarbonCredits)

	w := postJSON(t, r, "/api/credits/burn", map[string]interface{}{
		"amount":  2.0,
		"tx_hash": testTxHash,
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestBurnCarbonCredits_ExcludesFrozenCredits(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xburner", "user")
	seedBurnableCredits(t, db, user, 5, false) // frozen by a replantation debt

	r := setupIntegrityRouter(user.ID, user.WalletAddress)
	r.POST("/api/credits/burn", BurnCarbonCredits)

	w := postJSON(t, r, "/api/credits/burn", map[string]interface{}{
		"amount":  1.0,
		"tx_hash": testTxHash,
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when all credits are frozen, got %d: %s", w.Code, w.Body.String())
	}
}

func TestBurnCarbonCredits_RejectsReplayedTransactionHash(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xburner", "user")
	seedBurnableCredits(t, db, user, 10, true)

	r := setupIntegrityRouter(user.ID, user.WalletAddress)
	r.POST("/api/credits/burn", BurnCarbonCredits)

	first := postJSON(t, r, "/api/credits/burn", map[string]interface{}{
		"amount": 2.0, "tx_hash": testTxHash,
	})
	if first.Code != http.StatusOK {
		t.Fatalf("expected the first burn to succeed, got %d: %s", first.Code, first.Body.String())
	}

	second := postJSON(t, r, "/api/credits/burn", map[string]interface{}{
		"amount": 2.0, "tx_hash": testTxHash,
	})
	if second.Code != http.StatusConflict {
		t.Fatalf("expected 409 for a replayed burn tx, got %d: %s", second.Code, second.Body.String())
	}
}

func TestBurnCarbonCredits_VerifiesTheOnChainBurnWhenRPCConfigured(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "https://example.invalid")
	db := setupTestDB(t)
	user := createTestUser(t, db, "0x00000000000000000000000000000000000000bb", "user")
	seedBurnableCredits(t, db, user, 10, true)

	validBurn := &services.CreditBurn{
		Token:  common.HexToAddress("0x00000000000000000000000000000000000000cc"),
		From:   common.HexToAddress(user.WalletAddress),
		Amount: big.NewInt(2_000_000_000_000_000_000),
	}
	stubBurnDecoder(t, func(string) (*services.CreditBurn, error) { return validBurn, nil })

	r := setupIntegrityRouter(user.ID, user.WalletAddress)
	r.POST("/api/credits/burn", BurnCarbonCredits)

	w := postJSON(t, r, "/api/credits/burn", map[string]interface{}{
		"amount": 2.0, "tx_hash": testTxHash,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for a matching burn, got %d: %s", w.Code, w.Body.String())
	}
}

func TestBurnCarbonCredits_RejectsBurnFromAnotherWallet(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "https://example.invalid")
	db := setupTestDB(t)
	user := createTestUser(t, db, "0x00000000000000000000000000000000000000bb", "user")
	seedBurnableCredits(t, db, user, 10, true)

	stubBurnDecoder(t, func(string) (*services.CreditBurn, error) {
		return &services.CreditBurn{
			From:   common.HexToAddress("0x00000000000000000000000000000000000000dd"),
			Amount: big.NewInt(2_000_000_000_000_000_000),
		}, nil
	})

	r := setupIntegrityRouter(user.ID, user.WalletAddress)
	r.POST("/api/credits/burn", BurnCarbonCredits)

	w := postJSON(t, r, "/api/credits/burn", map[string]interface{}{
		"amount": 2.0, "tx_hash": testTxHash,
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for another wallet's burn, got %d: %s", w.Code, w.Body.String())
	}

	var burned int64
	db.Model(&models.CarbonCredit{}).Where("type = ?", "burned").Count(&burned)
	if burned != 0 {
		t.Errorf("expected no burn row, got %d", burned)
	}
}

func TestBurnCarbonCredits_RejectsAmountMismatch(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "https://example.invalid")
	db := setupTestDB(t)
	user := createTestUser(t, db, "0x00000000000000000000000000000000000000bb", "user")
	seedBurnableCredits(t, db, user, 10, true)

	// The wallet burned 1 credit but the request retires 2.
	stubBurnDecoder(t, func(string) (*services.CreditBurn, error) {
		return &services.CreditBurn{
			From:   common.HexToAddress(user.WalletAddress),
			Amount: big.NewInt(1_000_000_000_000_000_000),
		}, nil
	})

	r := setupIntegrityRouter(user.ID, user.WalletAddress)
	r.POST("/api/credits/burn", BurnCarbonCredits)

	w := postJSON(t, r, "/api/credits/burn", map[string]interface{}{
		"amount": 2.0, "tx_hash": testTxHash,
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for an amount mismatch, got %d: %s", w.Code, w.Body.String())
	}
}

func TestBurnCarbonCredits_RejectsUnconfirmedTransaction(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "https://example.invalid")
	db := setupTestDB(t)
	user := createTestUser(t, db, "0x00000000000000000000000000000000000000bb", "user")
	seedBurnableCredits(t, db, user, 10, true)

	stubBurnDecoder(t, func(string) (*services.CreditBurn, error) {
		return nil, errors.New("no EcoToken burn (Transfer to the zero address) found in transaction")
	})

	r := setupIntegrityRouter(user.ID, user.WalletAddress)
	r.POST("/api/credits/burn", BurnCarbonCredits)

	w := postJSON(t, r, "/api/credits/burn", map[string]interface{}{
		"amount": 2.0, "tx_hash": testTxHash,
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for a non-burn transaction, got %d: %s", w.Code, w.Body.String())
	}
}
