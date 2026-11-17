package controllers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"ecochain-backend/models"

	"github.com/google/uuid"
)

func TestGetMe_ReturnsAuthenticatedUser(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xme", "user")

	r := setupIntegrityRouter(user.ID, "0xme")
	r.GET("/api/auth/me", GetMe)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/api/auth/me", nil))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetMe_UnknownUserIsNotFound(t *testing.T) {
	setupTestEnv(t)
	setupTestDB(t)

	r := setupIntegrityRouter(uuid.New(), "0xghost")
	r.GET("/api/auth/me", GetMe)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/api/auth/me", nil))

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetUserStats_AggregatesTreesDebtsAndCredits(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xstats", "user")

	createTestTree(t, db, user.ID, "VERIFIED", "oak")
	createTestTree(t, db, user.ID, "CUT_CONFIRMED", "pine")
	createTestTree(t, db, user.ID, "PENDING_VERIFICATION", "maple")

	db.Create(&models.ReplantationDebt{
		ID:             uuid.New(),
		OriginalTreeID: "TREE-STATS-1",
		OwnerWallet:    "0xstats",
		TreesNeeded:    3,
		TreesVerified:  1,
		Status:         "IN_PROGRESS",
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	})
	db.Create(&models.CarbonCredit{
		ID: uuid.New(), UserID: user.ID, TreeID: uuid.New(),
		Amount: 2.5, Type: "verification_reward", CreatedAt: time.Now(),
	})

	r := setupIntegrityRouter(user.ID, "0xstats")
	r.GET("/api/auth/stats", GetUserStats)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/api/auth/stats", nil))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUpdateUserRole_AcceptsKnownRole(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	target := createTestUser(t, db, "0xpromote", "user")

	r := setupIntegrityRouter(uuid.New(), "0xadmin")
	r.PUT("/api/admin/users/:id/role", UpdateUserRole)

	w := postJSONTo(t, r, "PUT", "/api/admin/users/"+target.ID.String()+"/role", map[string]interface{}{
		"role": "verifier",
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var reloaded models.User
	db.First(&reloaded, "id = ?", target.ID)
	if reloaded.Role != "verifier" {
		t.Errorf("expected role verifier, got %s", reloaded.Role)
	}
}

func TestUpdateUserRole_RejectsUnknownRole(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	target := createTestUser(t, db, "0xpromote2", "user")

	r := setupIntegrityRouter(uuid.New(), "0xadmin")
	r.PUT("/api/admin/users/:id/role", UpdateUserRole)

	w := postJSONTo(t, r, "PUT", "/api/admin/users/"+target.ID.String()+"/role", map[string]interface{}{
		"role": "superuser",
	})

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}

	var reloaded models.User
	db.First(&reloaded, "id = ?", target.ID)
	if reloaded.Role != "user" {
		t.Errorf("expected the role to stay user, got %s", reloaded.Role)
	}
}

func TestUpdateUserRole_RejectsMissingRole(t *testing.T) {
	setupTestEnv(t)
	setupTestDB(t)

	r := setupIntegrityRouter(uuid.New(), "0xadmin")
	r.PUT("/api/admin/users/:id/role", UpdateUserRole)

	w := postJSONTo(t, r, "PUT", "/api/admin/users/"+uuid.New().String()+"/role", map[string]interface{}{})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}
