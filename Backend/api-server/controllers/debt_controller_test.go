package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"ecochain-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// setupDebtRouter builds a router whose auth middleware injects the given
// wallet/role into the context, mirroring middleware.AuthMiddleware. An empty
// wallet simulates a request with no authenticated wallet in context.
func setupDebtRouter(wallet, role string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("userID", "test-user-id")
		if wallet != "" {
			c.Set("walletAddress", wallet)
		}
		c.Set("role", role)
		c.Next()
	})
	return r
}

func createTestDebt(t *testing.T, db *gorm.DB, ownerWallet, originalTreeID string, needed int) models.ReplantationDebt {
	t.Helper()
	debt := models.ReplantationDebt{
		ID:             uuid.New(),
		OriginalTreeID: originalTreeID,
		OwnerWallet:    ownerWallet,
		TreesNeeded:    needed,
		Status:         "PENDING",
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}
	if err := db.Create(&debt).Error; err != nil {
		t.Fatal("failed to create test debt:", err)
	}
	return debt
}

func createOwnedTree(t *testing.T, db *gorm.DB, wallet string) models.Tree {
	t.Helper()
	tree := models.Tree{
		ID:                   uuid.New(),
		TreeID:               fmt.Sprintf("TREE-%s", uuid.New().String()[:8]),
		PlanterID:            uuid.New(),
		Species:              "oak",
		OwnerWallet:          wallet,
		Status:               "PENDING_VERIFICATION",
		CarbonAbsorptionRate: 20.0,
		PlantedAt:            time.Now(),
		HealthStatus:         "Healthy",
	}
	if err := db.Create(&tree).Error; err != nil {
		t.Fatal("failed to create test tree:", err)
	}
	return tree
}

func postLinkTree(t *testing.T, r *gin.Engine, debtID, treeID string) *httptest.ResponseRecorder {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"tree_id": treeID})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/debt/"+debtID+"/link-tree", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	return w
}

func countReplacementLinks(t *testing.T, db *gorm.DB, debtID string) int64 {
	t.Helper()
	var n int64
	db.Model(&models.ReplacementTree{}).Where("debt_id = ?", debtID).Count(&n)
	return n
}

func TestLinkTreeToDebt_ValidOwnerLinksOwnTree(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	debt := createTestDebt(t, db, "0xowner", "TREE-ORIGINAL", 2)
	tree := createOwnedTree(t, db, "0xowner")

	r := setupDebtRouter("0xowner", "user")
	r.POST("/api/debt/:id/link-tree", LinkTreeToDebt)

	w := postLinkTree(t, r, debt.ID.String(), tree.TreeID)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if n := countReplacementLinks(t, db, debt.ID.String()); n != 1 {
		t.Errorf("expected 1 replacement link, got %d", n)
	}
	var updated models.Tree
	db.First(&updated, "tree_id = ?", tree.TreeID)
	if !updated.IsReplacement {
		t.Errorf("expected tree to be marked as replacement")
	}
}

func TestLinkTreeToDebt_OwnerMatchIsCaseInsensitive(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	debt := createTestDebt(t, db, "0xOwner", "TREE-ORIGINAL", 2)
	tree := createOwnedTree(t, db, "0xowner")

	r := setupDebtRouter("0xowner", "user")
	r.POST("/api/debt/:id/link-tree", LinkTreeToDebt)

	w := postLinkTree(t, r, debt.ID.String(), tree.TreeID)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for case-insensitive owner match, got %d: %s", w.Code, w.Body.String())
	}
}

func TestLinkTreeToDebt_RejectsDebtOwnedByAnotherUser(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	debt := createTestDebt(t, db, "0xvictim", "TREE-ORIGINAL", 2)
	tree := createOwnedTree(t, db, "0xattacker")

	r := setupDebtRouter("0xattacker", "user")
	r.POST("/api/debt/:id/link-tree", LinkTreeToDebt)

	w := postLinkTree(t, r, debt.ID.String(), tree.TreeID)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
	if n := countReplacementLinks(t, db, debt.ID.String()); n != 0 {
		t.Errorf("expected no replacement link to be created, got %d", n)
	}
}

func TestLinkTreeToDebt_RejectsLinkingAnotherUsersTree(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	debt := createTestDebt(t, db, "0xowner", "TREE-ORIGINAL", 2)
	victimTree := createOwnedTree(t, db, "0xvictim")

	r := setupDebtRouter("0xowner", "user")
	r.POST("/api/debt/:id/link-tree", LinkTreeToDebt)

	w := postLinkTree(t, r, debt.ID.String(), victimTree.TreeID)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
	if n := countReplacementLinks(t, db, debt.ID.String()); n != 0 {
		t.Errorf("expected no replacement link to be created, got %d", n)
	}
	var victim models.Tree
	db.First(&victim, "tree_id = ?", victimTree.TreeID)
	if victim.IsReplacement {
		t.Errorf("expected victim tree to remain unmodified")
	}
}

func TestLinkTreeToDebt_RejectsWhenNoWalletInContext(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	debt := createTestDebt(t, db, "0xowner", "TREE-ORIGINAL", 2)
	tree := createOwnedTree(t, db, "0xowner")

	r := setupDebtRouter("", "user")
	r.POST("/api/debt/:id/link-tree", LinkTreeToDebt)

	w := postLinkTree(t, r, debt.ID.String(), tree.TreeID)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
	if n := countReplacementLinks(t, db, debt.ID.String()); n != 0 {
		t.Errorf("expected no replacement link to be created, got %d", n)
	}
}

func TestLinkTreeToDebt_RejectsClearedDebt(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	debt := createTestDebt(t, db, "0xowner", "TREE-ORIGINAL", 2)
	db.Model(&models.ReplantationDebt{}).Where("id = ?", debt.ID).Update("status", "CLEARED")
	tree := createOwnedTree(t, db, "0xowner")

	r := setupDebtRouter("0xowner", "user")
	r.POST("/api/debt/:id/link-tree", LinkTreeToDebt)

	w := postLinkTree(t, r, debt.ID.String(), tree.TreeID)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	if n := countReplacementLinks(t, db, debt.ID.String()); n != 0 {
		t.Errorf("expected no replacement link to be created, got %d", n)
	}
}

func TestGetAllDebts_RedactsSensitiveFields(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	d1 := createTestDebt(t, db, "0xownerA", "TREE-ORIG-A", 2)
	createTestDebt(t, db, "0xownerB", "TREE-ORIG-B", 3)
	// A linked replacement tree must not leak either.
	rt := models.ReplacementTree{
		ID:       uuid.New(),
		DebtID:   d1.ID,
		TreeID:   "TREE-REPL-X",
		LinkedAt: time.Now(),
	}
	if err := db.Create(&rt).Error; err != nil {
		t.Fatal("failed to create replacement link:", err)
	}

	// An ordinary (non-admin) user calls the public transparency endpoint.
	r := setupDebtRouter("0xrandom", "user")
	r.GET("/api/debt/all", GetAllDebts)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/debt/all", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var items []map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &items); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 debts, got %d", len(items))
	}

	// The payload must not contain any owner wallet or tree identifier.
	body := w.Body.String()
	for _, secret := range []string{"0xownerA", "0xownerB", "TREE-ORIG-A", "TREE-ORIG-B", "TREE-REPL-X"} {
		if strings.Contains(body, secret) {
			t.Errorf("response leaks sensitive value %q", secret)
		}
	}

	for _, item := range items {
		if item["owner_wallet"] != "" {
			t.Errorf("expected empty owner_wallet, got %v", item["owner_wallet"])
		}
		if item["original_tree_id"] != "" {
			t.Errorf("expected empty original_tree_id, got %v", item["original_tree_id"])
		}
		if _, ok := item["replacement_trees"]; ok {
			t.Errorf("expected replacement_trees to be omitted")
		}
	}
}
