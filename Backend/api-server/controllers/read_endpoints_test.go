package controllers

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"ecochain-backend/models"

	"github.com/google/uuid"
)

// ─────────────────────────────────────────────────
// Tree reads and growth updates
// ─────────────────────────────────────────────────

func TestGetTreeByID_FindsByUUIDAndByTreeID(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xtree", "user")
	tree := createTestTree(t, db, user.ID, "VERIFIED", "oak")

	r := setupRouter(db)
	r.GET("/api/trees/:id", GetTreeByID)

	byUUID := postJSONTo(t, r, "GET", "/api/trees/"+tree.ID.String(), nil)
	if byUUID.Code != http.StatusOK {
		t.Fatalf("expected 200 by UUID, got %d: %s", byUUID.Code, byUUID.Body.String())
	}

	byTreeID := postJSONTo(t, r, "GET", "/api/trees/"+tree.TreeID, nil)
	if byTreeID.Code != http.StatusOK {
		t.Fatalf("expected 200 by tree id, got %d: %s", byTreeID.Code, byTreeID.Body.String())
	}

	missing := postJSONTo(t, r, "GET", "/api/trees/does-not-exist", nil)
	if missing.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", missing.Code, missing.Body.String())
	}
}

func TestGetMyTrees_ReturnsOnlyTheCallersTrees(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	alice := createTestUser(t, db, "0xalice", "user")
	bob := createTestUser(t, db, "0xbob", "user")
	createTestTree(t, db, alice.ID, "VERIFIED", "oak")
	createTestTree(t, db, bob.ID, "VERIFIED", "pine")

	r := setupIntegrityRouter(alice.ID, alice.WalletAddress)
	r.GET("/api/trees/mine", GetMyTrees)

	w := postJSONTo(t, r, "GET", "/api/trees/mine", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var trees []models.Tree
	json.Unmarshal(w.Body.Bytes(), &trees)
	if len(trees) != 1 {
		t.Fatalf("expected 1 tree, got %d", len(trees))
	}
	if trees[0].PlanterID != alice.ID {
		t.Errorf("expected Alice's tree, got %s", trees[0].PlanterID)
	}
}

func TestGetPendingTrees_ReturnsOnlyPending(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xpending", "user")
	createTestTree(t, db, user.ID, "PENDING_VERIFICATION", "oak")
	createTestTree(t, db, user.ID, "VERIFIED", "pine")

	r := setupRouter(db)
	r.GET("/api/trees/pending", GetPendingTrees)

	w := postJSONTo(t, r, "GET", "/api/trees/pending", nil)
	var trees []models.Tree
	json.Unmarshal(w.Body.Bytes(), &trees)
	if len(trees) != 1 || trees[0].Status != "PENDING_VERIFICATION" {
		t.Fatalf("expected 1 pending tree, got %+v", trees)
	}
}

func TestGetTreeAllPublic_FiltersAndReturnsIPFSHash(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xpublic", "user")
	oak := createTestTree(t, db, user.ID, "VERIFIED", "oak")
	db.Model(&oak).Updates(map[string]interface{}{
		"ip_fs_hash":          "QmPublicOak",
		"blockchain_token_id": "77",
	})
	createTestTree(t, db, user.ID, "PENDING_VERIFICATION", "pine")

	r := setupRouter(db)
	r.GET("/api/trees/all", GetTreeAllPublic)

	all := postJSONTo(t, r, "GET", "/api/trees/all", nil)
	if all.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", all.Code, all.Body.String())
	}
	var trees []models.Tree
	if err := json.Unmarshal(all.Body.Bytes(), &trees); err != nil {
		t.Fatal("failed to decode response:", err)
	}
	if len(trees) != 2 {
		t.Fatalf("expected 2 public trees, got %d: %s", len(trees), all.Body.String())
	}
	foundIPFS := false
	for _, tree := range trees {
		if tree.IPFSHash == "QmPublicOak" {
			foundIPFS = true
		}
	}
	if !foundIPFS {
		t.Error("expected the selected columns to include ipfs_hash")
	}

	verified := postJSONTo(t, r, "GET", "/api/trees/all?status=VERIFIED", nil)
	json.Unmarshal(verified.Body.Bytes(), &trees)
	if len(trees) != 1 || trees[0].Species != "oak" {
		t.Errorf("expected only the verified oak, got %+v", trees)
	}

	pines := postJSONTo(t, r, "GET", "/api/trees/all?species=pin", nil)
	json.Unmarshal(pines.Body.Bytes(), &trees)
	if len(trees) != 1 || trees[0].Species != "pine" {
		t.Errorf("expected only the pine, got %+v", trees)
	}
}

func TestUpdateTreeGrowth_OwnerCanUpdateVerifiedTree(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xgrowth", "user")
	tree := createTestTree(t, db, user.ID, "VERIFIED", "oak")

	r := setupIntegrityRouter(user.ID, user.WalletAddress)
	r.PATCH("/api/trees/:id/growth", UpdateTreeGrowth)

	w := postJSONTo(t, r, "PATCH", "/api/trees/"+tree.ID.String()+"/growth", map[string]interface{}{
		"health_status": "Thriving",
		"image_url":     "https://example.com/tree.jpg",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var reloaded models.Tree
	db.First(&reloaded, "id = ?", tree.ID)
	if reloaded.HealthStatus != "Thriving" {
		t.Errorf("expected the health status to be updated, got %s", reloaded.HealthStatus)
	}
}

func TestUpdateTreeGrowth_RejectsOtherUsersAndUnverifiedTrees(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	owner := createTestUser(t, db, "0xowner", "user")
	other := createTestUser(t, db, "0xother", "user")
	verified := createTestTree(t, db, owner.ID, "VERIFIED", "oak")
	pending := createTestTree(t, db, other.ID, "PENDING_VERIFICATION", "pine")

	ownerRouter := setupIntegrityRouter(other.ID, other.WalletAddress)
	ownerRouter.PATCH("/api/trees/:id/growth", UpdateTreeGrowth)
	if w := postJSONTo(t, ownerRouter, "PATCH", "/api/trees/"+verified.ID.String()+"/growth", map[string]interface{}{"health_status": "Dead"}); w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for another user's tree, got %d: %s", w.Code, w.Body.String())
	}

	otherRouter := setupIntegrityRouter(other.ID, other.WalletAddress)
	otherRouter.PATCH("/api/trees/:id/growth", UpdateTreeGrowth)
	if w := postJSONTo(t, otherRouter, "PATCH", "/api/trees/"+pending.ID.String()+"/growth", map[string]interface{}{"health_status": "Thriving"}); w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for an unverified tree, got %d: %s", w.Code, w.Body.String())
	}

	missing := postJSONTo(t, ownerRouter, "PATCH", "/api/trees/"+uuid.New().String()+"/growth", map[string]interface{}{"health_status": "Dead"})
	if missing.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d: %s", missing.Code, missing.Body.String())
	}
}

// ─────────────────────────────────────────────────
// History / notifications / ledger / transactions
// ─────────────────────────────────────────────────

func TestGetTreeHistory_CombinesRegistrationVerificationCutAndLogs(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xhistory", "user")
	tree := createTestTree(t, db, user.ID, "CUT_CONFIRMED", "oak")
	confirmedAt := time.Now()
	db.Create(&models.CutReport{
		ID: uuid.New(), TreeID: tree.TreeID, OwnerWallet: tree.OwnerWallet,
		Reason: "Storm", CutDate: confirmedAt.AddDate(0, -1, 0), Status: "CONFIRMED",
		ConfirmedBy: "0xverifier", ConfirmedAt: &confirmedAt, CreatedAt: time.Now(),
	})
	db.Create(&models.Verification{
		ID: uuid.New(), TreeID: tree.ID, VerifierID: uuid.New(),
		Status: "VERIFIED", Notes: "looks good", CreatedAt: time.Now(),
	})
	db.Create(&models.ActivityLog{
		ID: uuid.New(), EventType: "DEBT_CLEARED", TreeID: tree.TreeID,
		Actor: tree.OwnerWallet, Description: "debt cleared", CreatedAt: time.Now(),
	})

	r := setupRouter(db)
	r.GET("/api/trees/:id/history", GetTreeHistory)

	w := postJSONTo(t, r, "GET", "/api/trees/"+tree.TreeID+"/history", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var response struct {
		Events []struct {
			EventType string `json:"event_type"`
		} `json:"events"`
	}
	json.Unmarshal(w.Body.Bytes(), &response)

	want := map[string]bool{"TREE_REGISTERED": false, "VERIFIED": false, "CUT_REPORTED": false, "CUT_CONFIRMED": false, "DEBT_CLEARED": false}
	for _, event := range response.Events {
		if _, ok := want[event.EventType]; ok {
			want[event.EventType] = true
		}
	}
	for event, found := range want {
		if !found {
			t.Errorf("expected the timeline to contain %s", event)
		}
	}

	missing := postJSONTo(t, r, "GET", "/api/trees/NOPE/history", nil)
	if missing.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d: %s", missing.Code, missing.Body.String())
	}
}

func TestGetNotifications_ReturnsOnlyTheCallersActivity(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	db.Create(&models.ActivityLog{
		ID: uuid.New(), EventType: "TREE_VERIFIED", Actor: "0xme",
		Description: "mine", CreatedAt: time.Now(),
	})
	db.Create(&models.ActivityLog{
		ID: uuid.New(), EventType: "TREE_VERIFIED", Actor: "0xother",
		Description: "not mine", CreatedAt: time.Now(),
	})

	r := setupIntegrityRouter(uuid.New(), "0xme")
	r.GET("/api/notifications", GetNotifications)

	w := postJSONTo(t, r, "GET", "/api/notifications", nil)
	var logs []models.ActivityLog
	json.Unmarshal(w.Body.Bytes(), &logs)
	if len(logs) != 1 || logs[0].Actor != "0xme" {
		t.Fatalf("expected only the caller's notification, got %+v", logs)
	}
}

func TestGetCreditHistory_ReturnsOnlyTheCallersLedger(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	db.Create(&models.CreditLedger{
		ID: uuid.New(), Wallet: "0xledger", EventType: "EARNED",
		Amount: 1, BalanceAfter: 1, CreatedAt: time.Now(),
	})
	db.Create(&models.CreditLedger{
		ID: uuid.New(), Wallet: "0xother", EventType: "EARNED",
		Amount: 2, BalanceAfter: 2, CreatedAt: time.Now(),
	})

	r := setupIntegrityRouter(uuid.New(), "0xledger")
	r.GET("/api/credits/history", GetCreditHistory)

	w := postJSONTo(t, r, "GET", "/api/credits/history", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var history []models.CreditLedger
	json.Unmarshal(w.Body.Bytes(), &history)
	if len(history) != 1 || history[0].Wallet != "0xledger" {
		t.Fatalf("expected only the caller's ledger rows, got %+v", history)
	}
}

func TestGetTransactions_ReturnsOnlyTheCallersTrades(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	db.Create(&models.MarketplaceTransaction{
		ID: uuid.New(), ListingID: uuid.New(), BuyerWallet: "0xme", SellerWallet: "0xseller",
		TreeID: "TREE-1", CreditsAmount: 1, TxHash: "0xtrade1", Status: "CONFIRMED", CreatedAt: time.Now(),
	})
	db.Create(&models.MarketplaceTransaction{
		ID: uuid.New(), ListingID: uuid.New(), BuyerWallet: "0xother", SellerWallet: "0xseller2",
		TreeID: "TREE-2", CreditsAmount: 1, TxHash: "0xtrade2", Status: "CONFIRMED", CreatedAt: time.Now(),
	})

	r := setupIntegrityRouter(uuid.New(), "0xme")
	r.GET("/api/transactions", GetTransactions)

	w := postJSONTo(t, r, "GET", "/api/transactions", nil)
	var txs []models.MarketplaceTransaction
	json.Unmarshal(w.Body.Bytes(), &txs)
	if len(txs) != 1 || txs[0].TxHash != "0xtrade1" {
		t.Fatalf("expected only the caller's transaction, got %+v", txs)
	}
}

// ─────────────────────────────────────────────────
// Small units
// ─────────────────────────────────────────────────

func TestUploadToIPFS_RejectsMissingFile(t *testing.T) {
	setupTestEnv(t)
	ginRouter := setupRouter(setupTestDB(t))
	ginRouter.POST("/api/ipfs/upload", UploadToIPFS)

	w := postJSONTo(t, ginRouter, "POST", "/api/ipfs/upload", map[string]interface{}{"nope": true})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for a missing file, got %d: %s", w.Code, w.Body.String())
	}
}

func TestMathAbs(t *testing.T) {
	if MathAbs(-2.5) != 2.5 || MathAbs(2.5) != 2.5 || MathAbs(0) != 0 {
		t.Error("MathAbs did not return the absolute value")
	}
}

func TestMintCreditsForTree(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xmint", "user")
	tree := createTestTree(t, db, user.ID, "VERIFIED", "oak")

	if err := MintCreditsForTree(tree.ID, 1.5, "0xminthash"); err != nil {
		t.Fatalf("expected the mint to succeed: %v", err)
	}
	var count int64
	db.Model(&models.CarbonCredit{}).Where("tree_id = ? AND type = ?", tree.ID, "minted").Count(&count)
	if count != 1 {
		t.Errorf("expected 1 minted credit row, got %d", count)
	}

	if err := MintCreditsForTree(uuid.New(), 1, "0xmissing"); err == nil {
		t.Error("expected an error for an unknown tree")
	}
}
