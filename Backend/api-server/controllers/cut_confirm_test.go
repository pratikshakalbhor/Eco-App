package controllers

import (
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"testing"
	"time"

	"ecochain-backend/models"
	"ecochain-backend/services"

	"github.com/ethereum/go-ethereum/common"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ─────────────────────────────────────────────────
// ConfirmCut
// ─────────────────────────────────────────────────

func createCutReportedTree(t *testing.T, db *gorm.DB, tokenID string) (models.Tree, models.CutReport) {
	t.Helper()
	owner := createTestUser(t, db, "0x00000000000000000000000000000000000000aa", "user")
	tree := models.Tree{
		ID: uuid.New(), TreeID: "TREE-CUT-" + uuid.New().String()[:8],
		PlanterID: owner.ID, Species: "oak", OwnerWallet: owner.WalletAddress,
		Latitude: 28.6139, Longitude: 77.2090, Status: "CUT_REPORTED",
		CarbonAbsorptionRate: 20, PlantedAt: time.Now().AddDate(-2, 0, 0),
		BlockchainTokenID: tokenID,
	}
	if err := db.Create(&tree).Error; err != nil {
		t.Fatal(err)
	}
	report := models.CutReport{
		ID: uuid.New(), TreeID: tree.TreeID, OwnerWallet: owner.WalletAddress,
		Reason: "Storm", CutDate: time.Now().AddDate(0, -1, 0),
		Status: "PENDING", CreatedAt: time.Now(),
	}
	if err := db.Create(&report).Error; err != nil {
		t.Fatal(err)
	}
	// The credits issued for this tree, used as the "credits lost" figure.
	db.Create(&models.CarbonCredit{
		ID: uuid.New(), UserID: owner.ID, TreeID: tree.ID,
		Amount: 3, Type: "verification_reward", Tradeable: false,
		TransactionHash: "0xcutcredit",
	})
	return tree, report
}

func TestConfirmCut_CreatesLossAndDebt(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "")
	db := setupTestDB(t)
	tree, report := createCutReportedTree(t, db, "9")

	r := setupIntegrityRouter(uuid.New(), "0xadmin")
	r.POST("/api/trees/:id/cut/confirm", ConfirmCut)

	w := postJSON(t, r, "/api/trees/"+tree.TreeID+"/cut/confirm", map[string]interface{}{})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var reloaded models.Tree
	db.First(&reloaded, "id = ?", tree.ID)
	if reloaded.Status != "CUT_CONFIRMED" {
		t.Errorf("expected CUT_CONFIRMED, got %s", reloaded.Status)
	}

	var reloadedReport models.CutReport
	db.First(&reloadedReport, "id = ?", report.ID)
	if reloadedReport.Status != "CONFIRMED" {
		t.Errorf("expected the report to be CONFIRMED, got %s", reloadedReport.Status)
	}
	if reloadedReport.ConfirmedBy != "0xadmin" {
		t.Errorf("expected the confirming admin wallet to be recorded, got %q", reloadedReport.ConfirmedBy)
	}

	var loss models.EnvironmentalLoss
	if err := db.First(&loss, "tree_id = ?", tree.TreeID).Error; err != nil {
		t.Fatalf("expected an environmental loss row: %v", err)
	}
	if loss.CO2LostKg <= 0 {
		t.Errorf("expected a positive CO2 loss, got %v", loss.CO2LostKg)
	}
	if loss.CreditsLost != 3 {
		t.Errorf("expected 3 credits lost from the ledger, got %v", loss.CreditsLost)
	}
	if loss.ReplacementTreesNeeded < 3 {
		t.Errorf("expected at least 3 replacement trees, got %d", loss.ReplacementTreesNeeded)
	}

	var debt models.ReplantationDebt
	if err := db.First(&debt, "original_tree_id = ?", tree.TreeID).Error; err != nil {
		t.Fatalf("expected a replantation debt: %v", err)
	}
	if debt.Status != "PENDING" {
		t.Errorf("expected a PENDING debt, got %s", debt.Status)
	}
	if debt.TreesNeeded != loss.ReplacementTreesNeeded {
		t.Errorf("expected the debt to need %d trees, got %d", loss.ReplacementTreesNeeded, debt.TreesNeeded)
	}
}

func TestConfirmCut_UnknownTreeIsNotFound(t *testing.T) {
	setupTestEnv(t)
	setupTestDB(t)

	r := setupIntegrityRouter(uuid.New(), "0xadmin")
	r.POST("/api/trees/:id/cut/confirm", ConfirmCut)

	w := postJSON(t, r, "/api/trees/DOES-NOT-EXIST/cut/confirm", map[string]interface{}{})
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestConfirmCut_RejectsTreeThatWasNotReportedCut(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "")
	db := setupTestDB(t)
	tree, _ := createCutReportedTree(t, db, "9")
	db.Model(&models.Tree{}).Where("id = ?", tree.ID).Update("status", "VERIFIED")

	r := setupIntegrityRouter(uuid.New(), "0xadmin")
	r.POST("/api/trees/:id/cut/confirm", ConfirmCut)

	w := postJSON(t, r, "/api/trees/"+tree.TreeID+"/cut/confirm", map[string]interface{}{})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}

	var debts int64
	db.Model(&models.ReplantationDebt{}).Count(&debts)
	if debts != 0 {
		t.Errorf("expected no debt to be created, got %d", debts)
	}
}

func TestConfirmCut_RejectsMissingPendingReport(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "")
	db := setupTestDB(t)
	tree, report := createCutReportedTree(t, db, "9")
	db.Model(&models.CutReport{}).Where("id = ?", report.ID).Update("status", "REJECTED")

	r := setupIntegrityRouter(uuid.New(), "0xadmin")
	r.POST("/api/trees/:id/cut/confirm", ConfirmCut)

	w := postJSON(t, r, "/api/trees/"+tree.TreeID+"/cut/confirm", map[string]interface{}{})
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestConfirmCut_RequiresTxHashWhenRPCConfigured(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "https://example.invalid")
	db := setupTestDB(t)
	tree, _ := createCutReportedTree(t, db, "9")

	r := setupIntegrityRouter(uuid.New(), "0xadmin")
	r.POST("/api/trees/:id/cut/confirm", ConfirmCut)

	w := postJSON(t, r, "/api/trees/"+tree.TreeID+"/cut/confirm", map[string]interface{}{})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestConfirmCut_RejectsUnconfirmedTransaction(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "https://example.invalid")
	db := setupTestDB(t)
	tree, _ := createCutReportedTree(t, db, "9")

	original := services.CutSettlementDecoder
	services.CutSettlementDecoder = func(string) (*services.CutSettlement, error) {
		return nil, errors.New("DebtCreated event not found in transaction")
	}
	t.Cleanup(func() { services.CutSettlementDecoder = original })

	r := setupIntegrityRouter(uuid.New(), "0xadmin")
	r.POST("/api/trees/:id/cut/confirm", ConfirmCut)

	w := postJSON(t, r, "/api/trees/"+tree.TreeID+"/cut/confirm", map[string]interface{}{"tx_hash": testTxHash})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestConfirmCut_RejectsSettlementForAnotherTree(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "https://example.invalid")
	db := setupTestDB(t)
	tree, _ := createCutReportedTree(t, db, "9")

	original := services.CutSettlementDecoder
	services.CutSettlementDecoder = func(string) (*services.CutSettlement, error) {
		return &services.CutSettlement{
			Confirmed:     services.TreeCutConfirmedEvent{TokenId: big.NewInt(10), Verifier: common.HexToAddress("0xverifier")},
			Debt:          services.DebtCreatedEvent{OriginalTokenId: big.NewInt(10), Debtor: common.HexToAddress(tree.OwnerWallet)},
			Frozen:        true,
			FrozenAccount: common.HexToAddress(tree.OwnerWallet),
		}, nil
	}
	t.Cleanup(func() { services.CutSettlementDecoder = original })

	r := setupIntegrityRouter(uuid.New(), "0xadmin")
	r.POST("/api/trees/:id/cut/confirm", ConfirmCut)

	w := postJSON(t, r, "/api/trees/"+tree.TreeID+"/cut/confirm", map[string]interface{}{"tx_hash": testTxHash})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}

	var debts int64
	db.Model(&models.ReplantationDebt{}).Count(&debts)
	if debts != 0 {
		t.Errorf("expected no debt for a mismatched settlement, got %d", debts)
	}
}

func TestConfirmCut_UsesOnChainReplacementCount(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "https://example.invalid")
	db := setupTestDB(t)
	tree, _ := createCutReportedTree(t, db, "9")

	original := services.CutSettlementDecoder
	services.CutSettlementDecoder = func(string) (*services.CutSettlement, error) {
		return &services.CutSettlement{
			Confirmed:     services.TreeCutConfirmedEvent{TokenId: big.NewInt(9), Verifier: common.HexToAddress("0xverifier")},
			Debt:          services.DebtCreatedEvent{OriginalTokenId: big.NewInt(9), Debtor: common.HexToAddress(tree.OwnerWallet), ReplacementsNeeded: 7},
			Frozen:        true,
			FrozenAccount: common.HexToAddress(tree.OwnerWallet),
		}, nil
	}
	t.Cleanup(func() { services.CutSettlementDecoder = original })

	r := setupIntegrityRouter(uuid.New(), "0xadmin")
	r.POST("/api/trees/:id/cut/confirm", ConfirmCut)

	w := postJSON(t, r, "/api/trees/"+tree.TreeID+"/cut/confirm", map[string]interface{}{"tx_hash": testTxHash})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var debt models.ReplantationDebt
	db.First(&debt, "original_tree_id = ?", tree.TreeID)
	if debt.TreesNeeded != 7 {
		t.Errorf("expected the on-chain count 7 to win, got %d", debt.TreesNeeded)
	}
	if debt.TransactionHash != testTxHash {
		t.Errorf("expected the tx hash to be stored, got %q", debt.TransactionHash)
	}
}

// ─────────────────────────────────────────────────
// RejectCut / GetCutReports / GetEnvironmentalLoss
// ─────────────────────────────────────────────────

func TestRejectCut_RestoresTreeAndUnfreezesCredits(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	tree, report := createCutReportedTree(t, db, "9")

	r := setupIntegrityRouter(uuid.New(), "0xadmin")
	r.POST("/api/trees/:id/cut/reject", RejectCut)

	w := postJSON(t, r, "/api/trees/"+tree.TreeID+"/cut/reject", map[string]interface{}{})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var reloadedTree models.Tree
	db.First(&reloadedTree, "id = ?", tree.ID)
	if reloadedTree.Status != "VERIFIED" {
		t.Errorf("expected the tree to be restored, got %s", reloadedTree.Status)
	}
	var reloadedReport models.CutReport
	db.First(&reloadedReport, "id = ?", report.ID)
	if reloadedReport.Status != "REJECTED" {
		t.Errorf("expected the report to be REJECTED, got %s", reloadedReport.Status)
	}
	var credits []models.CarbonCredit
	db.Where("tree_id = ?", tree.ID).Find(&credits)
	for _, credit := range credits {
		if !credit.Tradeable {
			t.Errorf("expected credit %s to be tradeable again", credit.ID)
		}
	}
}

func TestRejectCut_UnknownTreeIsNotFound(t *testing.T) {
	setupTestEnv(t)
	setupTestDB(t)

	r := setupIntegrityRouter(uuid.New(), "0xadmin")
	r.POST("/api/trees/:id/cut/reject", RejectCut)

	w := postJSON(t, r, "/api/trees/MISSING/cut/reject", map[string]interface{}{})
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetCutReports_FiltersAndEmbedsTrees(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	tree, _ := createCutReportedTree(t, db, "9")

	r := setupIntegrityRouter(uuid.New(), "0xadmin")
	r.GET("/api/trees/cut-reports", GetCutReports)

	w := postJSONTo(t, r, "GET", "/api/trees/cut-reports?status=PENDING", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var results []struct {
		models.CutReport
		Tree *models.Tree `json:"tree"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &results); err != nil {
		t.Fatal("failed to decode response:", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 pending report, got %d", len(results))
	}
	if results[0].Tree == nil || results[0].Tree.TreeID != tree.TreeID {
		t.Errorf("expected the report to embed its tree")
	}
}

func TestGetEnvironmentalLoss_ReturnsRecordOrNotFound(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	tree, _ := createCutReportedTree(t, db, "9")
	db.Create(&models.EnvironmentalLoss{
		ID: uuid.New(), TreeID: tree.TreeID, CO2LostKg: 250,
		CalculatedAt: time.Now(),
	})

	r := setupIntegrityRouter(uuid.New(), "0xadmin")
	r.GET("/api/trees/:id/loss", GetEnvironmentalLoss)

	found := postJSONTo(t, r, "GET", "/api/trees/"+tree.TreeID+"/loss", nil)
	if found.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", found.Code, found.Body.String())
	}

	missing := postJSONTo(t, r, "GET", "/api/trees/NOPE/loss", nil)
	if missing.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", missing.Code, missing.Body.String())
	}
}
