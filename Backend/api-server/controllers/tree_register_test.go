package controllers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"ecochain-backend/models"

	"github.com/google/uuid"
)

func registerTreeBody() map[string]interface{} {
	return map[string]interface{}{
		"species":            "oak",
		"nickname":           "Oakley",
		"latitude":           28.6139,
		"longitude":          77.2090,
		"location":           "New Delhi",
		"planting_date":      "2024-01-15",
		"blockchain_token_id": "101",
		"transaction_hash":   testTxHash,
	}
}

func postRegisterTree(t *testing.T, userID uuid.UUID, wallet string, body map[string]interface{}) (*httptest.ResponseRecorder, *models.Tree) {
	t.Helper()
	r := setupIntegrityRouter(userID, wallet)
	r.POST("/api/trees", RegisterTree)

	w := postJSON(t, r, "/api/trees", body)
	if w.Code != http.StatusCreated {
		return w, nil
	}

	var response struct {
		Tree models.Tree `json:"tree"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal("failed to decode register response:", err)
	}
	return w, &response.Tree
}

func TestRegisterTree_PersistsPendingTreeForAuthenticatedPlanter(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xplanter", "user")

	w, tree := postRegisterTree(t, user.ID, user.WalletAddress, registerTreeBody())
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
	if tree == nil {
		t.Fatal("expected a tree in the response")
	}

	if tree.PlanterID != user.ID {
		t.Errorf("expected planter %s, got %s", user.ID, tree.PlanterID)
	}
	if tree.OwnerWallet != user.WalletAddress {
		t.Errorf("expected owner wallet %s, got %s", user.WalletAddress, tree.OwnerWallet)
	}
	if tree.Status != "PENDING_VERIFICATION" {
		t.Errorf("expected PENDING_VERIFICATION, got %s", tree.Status)
	}
	if tree.CarbonAbsorptionRate != 21.0 {
		t.Errorf("expected the oak rate 21.0, got %v", tree.CarbonAbsorptionRate)
	}
	if tree.BlockchainTokenID != "101" {
		t.Errorf("expected token id 101, got %s", tree.BlockchainTokenID)
	}
	if got := tree.PlantedAt.Format("2006-01-02"); got != "2024-01-15" {
		t.Errorf("expected planting date 2024-01-15, got %s", got)
	}

	var stored models.Tree
	if err := db.First(&stored, "id = ?", tree.ID).Error; err != nil {
		t.Fatalf("tree was not persisted: %v", err)
	}
}

func TestRegisterTree_UsesDefaultRateForUnknownSpecies(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xplanter", "user")

	body := registerTreeBody()
	body["species"] = "baobab"
	body["blockchain_token_id"] = "102"

	_, tree := postRegisterTree(t, user.ID, user.WalletAddress, body)
	if tree == nil {
		t.Fatal("expected a tree in the response")
	}
	if tree.CarbonAbsorptionRate != 18.5 {
		t.Errorf("expected the default rate 18.5, got %v", tree.CarbonAbsorptionRate)
	}
}

func TestRegisterTree_RejectsMissingSpecies(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xplanter", "user")

	body := registerTreeBody()
	delete(body, "species")

	r := setupIntegrityRouter(user.ID, user.WalletAddress)
	r.POST("/api/trees", RegisterTree)

	w := postJSON(t, r, "/api/trees", body)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}

	var count int64
	db.Model(&models.Tree{}).Count(&count)
	if count != 0 {
		t.Errorf("expected no tree to be stored, got %d", count)
	}
}

func TestRegisterTree_RejectsUnknownAuthenticatedUser(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	r := setupIntegrityRouter(uuid.New(), "0xunknown")
	r.POST("/api/trees", RegisterTree)

	w := postJSON(t, r, "/api/trees", registerTreeBody())
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}

	var count int64
	db.Model(&models.Tree{}).Count(&count)
	if count != 0 {
		t.Errorf("expected no tree to be stored, got %d", count)
	}
}

func TestRegisterTree_RejectsDuplicateOnChainTokenID(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	alice := createTestUser(t, db, "0xalice", "user")
	bob := createTestUser(t, db, "0xbob", "user")

	_, first := postRegisterTree(t, alice.ID, alice.WalletAddress, registerTreeBody())
	if first == nil {
		t.Fatal("expected the first registration to succeed")
	}

	// Bob claims the same on-chain NFT. That is exactly the double counting
	// the unique partial index exists to stop.
	second := registerTreeBody()
	second["transaction_hash"] = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

	r := setupIntegrityRouter(bob.ID, bob.WalletAddress)
	r.POST("/api/trees", RegisterTree)
	w := postJSON(t, r, "/api/trees", second)

	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
	}

	var count int64
	db.Model(&models.Tree{}).Where("blockchain_token_id = ?", "101").Count(&count)
	if count != 1 {
		t.Errorf("expected exactly 1 tree for the token id, got %d", count)
	}
}

func TestRegisterTree_InvalidPlantingDateFallsBackToNow(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xplanter", "user")

	body := registerTreeBody()
	body["planting_date"] = "15/01/2024"
	body["blockchain_token_id"] = "103"

	_, tree := postRegisterTree(t, user.ID, user.WalletAddress, body)
	if tree == nil {
		t.Fatal("expected a tree in the response")
	}
	if time.Since(tree.PlantedAt) > time.Minute {
		t.Errorf("expected a fallback planting time of now, got %s", tree.PlantedAt)
	}
}
