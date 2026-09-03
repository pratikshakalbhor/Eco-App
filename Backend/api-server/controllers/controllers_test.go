package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"ecochain-backend/config"
	"ecochain-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const testSecret = "test-controller-secret"

func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal("failed to open test db:", err)
	}
	db.AutoMigrate(
		&models.User{}, &models.Tree{}, &models.CarbonCredit{},
		&models.Verification{}, &models.CutReport{}, &models.EnvironmentalLoss{},
		&models.ReplantationDebt{}, &models.ReplacementTree{}, &models.CompensationRecord{},
		&models.ActivityLog{}, &models.RestorationCertificate{},
		&models.MarketplaceListing{}, &models.MarketplaceTransaction{}, &models.CreditLedger{},
	)
	config.DB = db
	return db
}

func setupTestEnv(t *testing.T) {
	t.Helper()
	os.Setenv("JWT_SECRET", testSecret)
	gin.SetMode(gin.TestMode)
}

func makeToken(userID, wallet, role string) string {
	claims := jwt.MapClaims{
		"user_id":        userID,
		"wallet_address": wallet,
		"role":           role,
		"exp":            time.Now().Add(24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, _ := token.SignedString([]byte(testSecret))
	return s
}

func setupRouter(_ *gorm.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("userID", "test-user-id")
		c.Set("walletAddress", "0xtestwallet")
		c.Set("role", "user")
		c.Next()
	})
	return r
}

func createTestUser(t *testing.T, db *gorm.DB, wallet string, role string) models.User {
	t.Helper()
	user := models.User{
		ID:            uuid.New(),
		WalletAddress: wallet,
		Role:          role,
		Nonce:         "test-nonce",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal("failed to create test user:", err)
	}
	return user
}

func createTestTree(t *testing.T, db *gorm.DB, planterID uuid.UUID, status string, species string) models.Tree {
	t.Helper()
	tree := models.Tree{
		ID:                   uuid.New(),
		TreeID:               fmt.Sprintf("TREE-%s", uuid.New().String()[:8]),
		PlanterID:            planterID,
		Species:              species,
		Nickname:             "Test Tree",
		OwnerWallet:          "0xtestwallet",
		Latitude:             28.6139,
		Longitude:            77.2090,
		Status:               status,
		CarbonAbsorptionRate: 20.0,
		PlantedAt:            time.Now().AddDate(0, -3, 0),
		HealthStatus:         "Healthy",
	}
	if err := db.Create(&tree).Error; err != nil {
		t.Fatal("failed to create test tree:", err)
	}
	return tree
}

// ─────────────────────────────────────────────────
// Activity Controller Tests
// ─────────────────────────────────────────────────

func TestGetRecentActivity_Empty(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)

	r.GET("/api/activity/recent", GetRecentActivity)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/activity/recent", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var result []models.ActivityLog
	json.Unmarshal(w.Body.Bytes(), &result)
	if len(result) != 0 {
		t.Errorf("expected empty list, got %d items", len(result))
	}
}

func TestGetRecentActivity_WithData(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)

	// Insert activity logs
	for i := 0; i < 15; i++ {
		db.Create(&models.ActivityLog{
			ID:          uuid.New(),
			EventType:   "TREE_PLANTED",
			TreeID:      fmt.Sprintf("TREE-%d", i),
			Actor:       "0xtest",
			Description: fmt.Sprintf("Tree %d planted", i),
		})
	}

	r.GET("/api/activity/recent", GetRecentActivity)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/activity/recent", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var result []models.ActivityLog
	json.Unmarshal(w.Body.Bytes(), &result)
	if len(result) != 10 {
		t.Errorf("expected 10 items (limit), got %d", len(result))
	}
}

func TestFormatEventDescription(t *testing.T) {
	tests := []struct {
		eventType string
		species   string
		treeID    string
		contains  string
	}{
		{"TREE_PLANTED", "oak", "T-1", "oak tree planted"},
		{"TREE_VERIFIED", "pine", "T-2", "pine tree verified"},
		{"CUT_REPORTED", "maple", "T-3", "Tree cut reported for maple"},
		{"CUT_CONFIRMED", "bamboo", "T-4", "Tree cut confirmed for bamboo"},
		{"DEBT_CLEARED", "oak", "T-5", "Replantation debt resolved"},
		{"UNKNOWN_EVENT", "x", "y", "Ecosystem event recorded"},
	}

	for _, tt := range tests {
		t.Run(tt.eventType, func(t *testing.T) {
			result := FormatEventDescription(tt.eventType, tt.species, tt.treeID)
			if !containsStr(result, tt.contains) {
				t.Errorf("FormatEventDescription(%s) = %q, should contain %q", tt.eventType, result, tt.contains)
			}
		})
	}
}

// ─────────────────────────────────────────────────
// Auth Controller Tests
// ─────────────────────────────────────────────────

func TestGetNonce_MissingAddress(t *testing.T) {
	setupTestEnv(t)
	setupTestDB(t)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/auth/nonce", GetNonce)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/auth/nonce", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing address, got %d", w.Code)
	}
}

func TestGetNonce_NewUser(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/auth/nonce", GetNonce)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/auth/nonce?address=0xnewaddress", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var result map[string]string
	json.Unmarshal(w.Body.Bytes(), &result)
	if result["nonce"] == "" {
		t.Error("expected non-empty nonce")
	}

	// Verify user was created
	var user models.User
	db.Where("wallet_address = ?", "0xnewaddress").First(&user)
	if user.ID == uuid.Nil {
		t.Error("expected user to be created")
	}
}

func TestGetNonce_ExistingUser(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xexisting", "user")

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/auth/nonce", GetNonce)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/auth/nonce?address=0xexisting", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	// Verify nonce was updated
	var updated models.User
	db.First(&updated, user.ID)
	if updated.Nonce == "test-nonce" {
		t.Error("expected nonce to be updated")
	}
}

func TestVerifySignature_MissingFields(t *testing.T) {
	setupTestEnv(t)
	setupTestDB(t)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/auth/verify", VerifySignature)

	// Empty body
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/auth/verify", bytes.NewBufferString("{}"))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing fields, got %d", w.Code)
	}
}

func TestVerifySignature_UserNotFound(t *testing.T) {
	setupTestEnv(t)
	setupTestDB(t)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/auth/verify", VerifySignature)

	body, _ := json.Marshal(map[string]string{
		"address":   "0xnonexistent",
		"signature": "0xsignature",
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/auth/verify", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404 for nonexistent user, got %d", w.Code)
	}
}

// ─────────────────────────────────────────────────
// Tree Controller Tests (using mock context)
// ─────────────────────────────────────────────────

func TestGetAllTrees_Empty(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)

	r.GET("/api/trees", GetAllTrees)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/trees", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestGetAllTrees_WithData(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xplanter", "user")

	createTestTree(t, db, user.ID, "VERIFIED", "oak")
	createTestTree(t, db, user.ID, "PENDING_VERIFICATION", "pine")

	r := setupRouter(db)
	r.GET("/api/trees", GetAllTrees)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/trees", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var trees []models.Tree
	json.Unmarshal(w.Body.Bytes(), &trees)
	if len(trees) != 2 {
		t.Errorf("expected 2 trees, got %d", len(trees))
	}
}

func TestGetTreeStats(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	user := createTestUser(t, db, "0xplanter", "user")

	createTestTree(t, db, user.ID, "VERIFIED", "oak")
	createTestTree(t, db, user.ID, "PENDING_VERIFICATION", "pine")
	createTestTree(t, db, user.ID, "VERIFIED", "maple")

	r := setupRouter(db)
	r.GET("/api/trees/stats", GetTreeStats)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/trees/stats", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var stats map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &stats)

	totalTrees := int(stats["total"].(float64))
	if totalTrees != 3 {
		t.Errorf("expected total 3, got %d", totalTrees)
	}
}

// ─────────────────────────────────────────────────
// Environment Controller Tests
// ─────────────────────────────────────────────────

func TestGetEnvironmentStats(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)

	r.GET("/api/environment/stats", GetEnvironmentStats)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/environment/stats", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestGetSpeciesStats(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)

	r.GET("/api/environment/species-stats", GetSpeciesStats)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/environment/species-stats", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// ─────────────────────────────────────────────────
// Credit Controller Tests
// ─────────────────────────────────────────────────

func TestGetCreditBalance_NoUser(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)

	r.GET("/api/credits/balance", GetCreditBalance)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/credits/balance", nil)
	r.ServeHTTP(w, req)

	// Should return 200 with zero balance since no credits exist
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// ─────────────────────────────────────────────────
// Admin Controller Tests
// ─────────────────────────────────────────────────

func TestGetAdminStats(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	createTestUser(t, db, "0xuser1", "user")
	createTestUser(t, db, "0xuser2", "verifier")

	r := setupRouter(db)
	r.Use(func(c *gin.Context) {
		c.Set("role", "admin")
		c.Next()
	})
	r.GET("/api/admin/stats", GetAdminStats)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/admin/stats", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var stats map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &stats)

	totalUsers := int(stats["total_users"].(float64))
	if totalUsers != 2 { // 2 users created in the test; middleware mock only sets context, does not insert a User row
		t.Errorf("expected total_users 2, got %d", totalUsers)
	}
}

func TestGetAllUsers(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	createTestUser(t, db, "0xwallet1", "user")
	createTestUser(t, db, "0xwallet2", "verifier")

	r := setupRouter(db)
	r.Use(func(c *gin.Context) {
		c.Set("role", "admin")
		c.Next()
	})
	r.GET("/api/admin/users", GetAllUsers)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/admin/users", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var users []models.User
	json.Unmarshal(w.Body.Bytes(), &users)
	if len(users) < 2 {
		t.Errorf("expected at least 2 users, got %d", len(users))
	}
}

// ─────────────────────────────────────────────────
// Debt Controller Tests
// ─────────────────────────────────────────────────

func TestGetMyDebts_Empty(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)

	r.GET("/api/debt", GetMyDebts)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/debt", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// ─────────────────────────────────────────────────
// Marketplace Controller Tests
// ─────────────────────────────────────────────────

func TestGetMarketplaceListings_Empty(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)

	r.GET("/api/marketplace/listings", GetMarketplaceListings)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/marketplace/listings", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestGetMarketplaceStats(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)

	r.GET("/api/marketplace/stats", GetMarketplaceStats)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/marketplace/stats", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// ─────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────

func containsStr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
