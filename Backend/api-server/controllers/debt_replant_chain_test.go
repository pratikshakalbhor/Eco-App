package controllers

import (
	"errors"
	"math/big"
	"net/http"
	"testing"
	"time"

	"ecochain-backend/models"
	"ecochain-backend/services"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ─────────────────────────────────────────────────
// LinkTreeToDebt — on-chain-backed paths
// ─────────────────────────────────────────────────

func createReplantScenario(t *testing.T, db *gorm.DB, replacementStatus string, needed int) (models.ReplantationDebt, models.Tree, models.Tree) {
	t.Helper()
	owner := createTestUser(t, db, "0xreplanter", "user")
	original := models.Tree{
		ID: uuid.New(), TreeID: "TREE-ORIG-" + uuid.New().String()[:8],
		PlanterID: owner.ID, Species: "oak", OwnerWallet: owner.WalletAddress,
		Status: "CUT_CONFIRMED", BlockchainTokenID: "1001",
		CarbonAbsorptionRate: 20, PlantedAt: time.Now().AddDate(-2, 0, 0),
	}
	if err := db.Create(&original).Error; err != nil {
		t.Fatal(err)
	}
	replacement := models.Tree{
		ID: uuid.New(), TreeID: "TREE-REPL-" + uuid.New().String()[:8],
		PlanterID: owner.ID, Species: "oak", OwnerWallet: owner.WalletAddress,
		Status: replacementStatus, BlockchainTokenID: "1002",
		CarbonAbsorptionRate: 20, PlantedAt: time.Now().AddDate(0, -3, 0),
	}
	if err := db.Create(&replacement).Error; err != nil {
		t.Fatal(err)
	}
	debt := models.ReplantationDebt{
		ID: uuid.New(), OriginalTreeID: original.TreeID, OwnerWallet: owner.WalletAddress,
		TreesNeeded: needed, Status: "PENDING", CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	if err := db.Create(&debt).Error; err != nil {
		t.Fatal(err)
	}
	return debt, original, replacement
}

func stubReplantationDecoder(t *testing.T, fn func(txHash string) (*services.TreeReplantedEvent, error)) {
	t.Helper()
	original := services.ReplantationDecoder
	services.ReplantationDecoder = fn
	t.Cleanup(func() { services.ReplantationDecoder = original })
}

func TestLinkTreeToDebt_RequiresTxHashWhenRPCConfigured(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "https://example.invalid")
	db := setupTestDB(t)
	debt, _, replacement := createReplantScenario(t, db, "VERIFIED", 2)

	r := setupDebtRouter("0xreplanter", "user")
	r.POST("/api/debt/:id/link-tree", LinkTreeToDebt)

	w := postLinkTree(t, r, debt.ID.String(), replacement.TreeID)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestLinkTreeToDebt_RejectsUnconfirmedTransaction(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "https://example.invalid")
	db := setupTestDB(t)
	debt, _, replacement := createReplantScenario(t, db, "VERIFIED", 2)

	stubReplantationDecoder(t, func(string) (*services.TreeReplantedEvent, error) {
		return nil, errors.New("TreeReplanted event not found in transaction")
	})

	r := setupDebtRouter("0xreplanter", "user")
	r.POST("/api/debt/:id/link-tree", LinkTreeToDebt)

	w := postJSON(t, r, "/api/debt/"+debt.ID.String()+"/link-tree", map[string]interface{}{
		"tree_id": replacement.TreeID,
		"tx_hash": testTxHash,
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestLinkTreeToDebt_RejectsTransactionForAnotherReplacementTree(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "https://example.invalid")
	db := setupTestDB(t)
	debt, _, replacement := createReplantScenario(t, db, "VERIFIED", 2)

	stubReplantationDecoder(t, func(string) (*services.TreeReplantedEvent, error) {
		return &services.TreeReplantedEvent{
			ReplacementTokenId: big.NewInt(9999), // not this tree
			OriginalTokenId:    big.NewInt(1001),
		}, nil
	})

	r := setupDebtRouter("0xreplanter", "user")
	r.POST("/api/debt/:id/link-tree", LinkTreeToDebt)

	w := postJSON(t, r, "/api/debt/"+debt.ID.String()+"/link-tree", map[string]interface{}{
		"tree_id": replacement.TreeID,
		"tx_hash": testTxHash,
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	if n := countReplacementLinks(t, db, debt.ID.String()); n != 0 {
		t.Errorf("expected no link to be stored, got %d", n)
	}
}

func TestLinkTreeToDebt_AcceptsMatchingOnChainEvent(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "https://example.invalid")
	db := setupTestDB(t)
	debt, _, replacement := createReplantScenario(t, db, "VERIFIED", 3)

	stubReplantationDecoder(t, func(string) (*services.TreeReplantedEvent, error) {
		return &services.TreeReplantedEvent{
			ReplacementTokenId: big.NewInt(1002),
			OriginalTokenId:    big.NewInt(1001),
		}, nil
	})

	r := setupDebtRouter("0xreplanter", "user")
	r.POST("/api/debt/:id/link-tree", LinkTreeToDebt)

	w := postJSON(t, r, "/api/debt/"+debt.ID.String()+"/link-tree", map[string]interface{}{
		"tree_id": replacement.TreeID,
		"tx_hash": testTxHash,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var link models.ReplacementTree
	if err := db.First(&link, "debt_id = ?", debt.ID).Error; err != nil {
		t.Fatal("expected a replacement link:", err)
	}
	if link.TransactionHash != testTxHash {
		t.Errorf("expected the tx hash to be stored, got %q", link.TransactionHash)
	}
}

func TestLinkTreeToDebt_ClearsDebtAndIssuesCertificate(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "")
	db := setupTestDB(t)
	debt, original, replacement := createReplantScenario(t, db, "VERIFIED", 1)

	// Credits from the cut tree are frozen while the debt is open.
	db.Create(&models.CarbonCredit{
		ID: uuid.New(), UserID: uuid.New(), TreeID: original.ID,
		Amount: 2, Type: "verification_reward", Tradeable: false,
		TransactionHash: "0xfrozencredit",
	})
	db.Create(&models.EnvironmentalLoss{
		ID: uuid.New(), TreeID: original.TreeID, CO2LostKg: 400, CreditsLost: 2,
		CalculatedAt: time.Now(),
	})

	r := setupDebtRouter("0xreplanter", "user")
	r.POST("/api/debt/:id/link-tree", LinkTreeToDebt)

	w := postLinkTree(t, r, debt.ID.String(), replacement.TreeID)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var reloaded models.ReplantationDebt
	db.First(&reloaded, "id = ?", debt.ID)
	if reloaded.Status != "CLEARED" {
		t.Errorf("expected the debt to be CLEARED, got %s", reloaded.Status)
	}
	if reloaded.CertificateID == "" {
		t.Error("expected a restoration certificate id")
	}

	var cert models.RestorationCertificate
	if err := db.First(&cert, "debt_id = ?", debt.ID).Error; err != nil {
		t.Fatalf("expected a certificate: %v", err)
	}
	if cert.CO2RestoredKg != 400 {
		t.Errorf("expected 400 kg restored, got %v", cert.CO2RestoredKg)
	}

	var credit models.CarbonCredit
	db.First(&credit, "tree_id = ?", original.ID)
	if !credit.Tradeable {
		t.Error("expected the original tree's credits to be unfrozen")
	}
}

func TestLinkTreeToDebt_RejectsAlreadyLinkedTree(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "")
	db := setupTestDB(t)
	debt, _, replacement := createReplantScenario(t, db, "VERIFIED", 3)

	r := setupDebtRouter("0xreplanter", "user")
	r.POST("/api/debt/:id/link-tree", LinkTreeToDebt)

	if w := postLinkTree(t, r, debt.ID.String(), replacement.TreeID); w.Code != http.StatusOK {
		t.Fatalf("expected the first link to succeed, got %d: %s", w.Code, w.Body.String())
	}
	if w := postLinkTree(t, r, debt.ID.String(), replacement.TreeID); w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for a duplicate link, got %d: %s", w.Code, w.Body.String())
	}
}

func TestLinkTreeToDebt_RejectsUnknownTree(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "")
	db := setupTestDB(t)
	debt, _, _ := createReplantScenario(t, db, "VERIFIED", 3)

	r := setupDebtRouter("0xreplanter", "user")
	r.POST("/api/debt/:id/link-tree", LinkTreeToDebt)

	w := postLinkTree(t, r, debt.ID.String(), "TREE-MISSING")
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

// ─────────────────────────────────────────────────
// Debt reads
// ─────────────────────────────────────────────────

func TestGetDebtByID_ReturnsDebtAndReplacementTrees(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	debt, _, replacement := createReplantScenario(t, db, "VERIFIED", 2)
	db.Create(&models.ReplacementTree{
		ID: uuid.New(), DebtID: debt.ID, TreeID: replacement.TreeID, LinkedAt: time.Now(),
	})

	r := setupDebtRouter("0xreplanter", "user")
	r.GET("/api/debt/:id", GetDebtByID)

	w := postJSONTo(t, r, "GET", "/api/debt/"+debt.ID.String(), nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetCertificateData_ReturnsCertificateOrNotFound(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	debt, original, replacement := createReplantScenario(t, db, "VERIFIED", 1)
	cert := models.RestorationCertificate{
		ID: uuid.New(), CertificateID: "CERT-TEST", DebtID: debt.ID,
		IssuedTo: debt.OwnerWallet, OriginalTreeID: original.TreeID,
		CO2RestoredKg: 400, CreditsRestored: 2, IssuedAt: time.Now(),
	}
	db.Create(&cert)
	db.Create(&models.ReplacementTree{
		ID: uuid.New(), DebtID: debt.ID, TreeID: replacement.TreeID, LinkedAt: time.Now(),
	})

	r := setupDebtRouter("0xreplanter", "user")
	r.GET("/api/debt/:id/certificate", GetCertificateData)

	found := postJSONTo(t, r, "GET", "/api/debt/"+debt.ID.String()+"/certificate", nil)
	if found.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", found.Code, found.Body.String())
	}

	missing := postJSONTo(t, r, "GET", "/api/debt/"+uuid.New().String()+"/certificate", nil)
	if missing.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", missing.Code, missing.Body.String())
	}
}

// ─────────────────────────────────────────────────
// VerifyTree → replacement debt auto-clear
// ─────────────────────────────────────────────────

func TestVerifyTree_ReplacementClearsDebtWhenEnoughTreesVerified(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "")
	db := setupTestDB(t)

	debt, original, replacement := createReplantScenario(t, db, "PENDING_VERIFICATION", 2)
	db.Model(&models.Tree{}).Where("id = ?", replacement.ID).
		Updates(map[string]interface{}{"is_replacement": true, "replanted_debt_id": debt.ID})

	// The first replacement tree is already verified and linked.
	first := models.Tree{
		ID: uuid.New(), TreeID: "TREE-REPL-FIRST", PlanterID: original.PlanterID,
		Species: "oak", OwnerWallet: original.OwnerWallet, Status: "VERIFIED",
		CarbonAbsorptionRate: 20, PlantedAt: time.Now().AddDate(0, -6, 0),
	}
	db.Create(&first)
	db.Create(&models.ReplacementTree{ID: uuid.New(), DebtID: debt.ID, TreeID: first.TreeID, LinkedAt: time.Now()})
	db.Create(&models.ReplacementTree{ID: uuid.New(), DebtID: debt.ID, TreeID: replacement.TreeID, LinkedAt: time.Now()})

	db.Create(&models.CarbonCredit{
		ID: uuid.New(), UserID: original.PlanterID, TreeID: original.ID,
		Amount: 2, Type: "verification_reward", Tradeable: false,
		TransactionHash: "0xfrozen-orig",
	})
	db.Create(&models.EnvironmentalLoss{ID: uuid.New(), TreeID: original.TreeID, CO2LostKg: 300, CalculatedAt: time.Now()})

	r := setupIntegrityRouter(uuid.New(), "0xverifier")
	r.POST("/api/trees/:id/verify", VerifyTree)

	w := postJSON(t, r, "/api/trees/"+replacement.ID.String()+"/verify", map[string]interface{}{
		"status": "VERIFIED",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var reloaded models.ReplantationDebt
	db.First(&reloaded, "id = ?", debt.ID)
	if reloaded.Status != "CLEARED" {
		t.Errorf("expected the debt to be cleared automatically, got %s", reloaded.Status)
	}
	if reloaded.TreesVerified < reloaded.TreesNeeded {
		t.Errorf("a cleared debt must have verified >= needed, got %d/%d", reloaded.TreesVerified, reloaded.TreesNeeded)
	}
	if reloaded.CertificateID == "" {
		t.Error("expected a restoration certificate")
	}

	var credit models.CarbonCredit
	db.First(&credit, "tree_id = ?", original.ID)
	if !credit.Tradeable {
		t.Error("expected the original tree's credits to be unfrozen")
	}
}

func TestVerifyTree_ReplacementKeepsDebtOpenUntilEnoughTreesVerified(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("RPC_URL", "")
	db := setupTestDB(t)

	debt, original, replacement := createReplantScenario(t, db, "PENDING_VERIFICATION", 3)
	db.Model(&models.Tree{}).Where("id = ?", replacement.ID).
		Updates(map[string]interface{}{"is_replacement": true, "replanted_debt_id": debt.ID})
	db.Create(&models.ReplacementTree{ID: uuid.New(), DebtID: debt.ID, TreeID: replacement.TreeID, LinkedAt: time.Now()})

	r := setupIntegrityRouter(uuid.New(), "0xverifier")
	r.POST("/api/trees/:id/verify", VerifyTree)

	w := postJSON(t, r, "/api/trees/"+replacement.ID.String()+"/verify", map[string]interface{}{
		"status": "VERIFIED",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var reloaded models.ReplantationDebt
	db.First(&reloaded, "id = ?", debt.ID)
	if reloaded.Status == "CLEARED" {
		t.Error("expected the debt to stay open at 1/3 verified trees")
	}
	if reloaded.TreesVerified != 1 {
		t.Errorf("expected 1 verified replacement, got %d", reloaded.TreesVerified)
	}
	if original.Status != "CUT_CONFIRMED" {
		t.Errorf("the original tree must stay cut, got %s", original.Status)
	}
}
