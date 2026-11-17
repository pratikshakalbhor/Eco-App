package controllers

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"ecochain-backend/config"
	"ecochain-backend/models"
	"ecochain-backend/services"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const testSecret = "test-controller-secret"

func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	// A file-backed SQLite database is used (one per test, in a temp dir) so
	// that every connection in the pool — including the one a transaction
	// pins — sees the same schema.
	//
	// Two alternatives were tried and rejected:
	//   - ":memory:" gives every connection its own empty database, so any
	//     query issued inside a transaction failed with "no such table".
	//   - "mode=memory&cache=shared" shares the schema but makes the SQLite
	//     driver's unlock_notify retry deadlock when two connections write
	//     concurrently (SQLITE_LOCKED_SHAREDCACHE).
	//
	// WAL keeps readers out of the writer's way and the short busy timeout
	// turns a concurrent write into a fast error instead of a stall.
	dsn := fmt.Sprintf("file:%s?journal_mode=WAL&busy_timeout=500",
		filepath.ToSlash(filepath.Join(t.TempDir(), "ecochain-test.db")))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		// Translate native unique-constraint violations onto
		// gorm.ErrDuplicatedKey, matching production configuration.
		TranslateError: true,
	})
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
	sqlDB, err := db.DB()
	if err == nil {
		t.Cleanup(func() { sqlDB.Close() })
	}
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

func createTestListing(t *testing.T, db *gorm.DB, sellerWallet string, credits float64) models.MarketplaceListing {
	t.Helper()
	listing := models.MarketplaceListing{
		ID:             uuid.New(),
		SellerWallet:   sellerWallet,
		TreeID:         fmt.Sprintf("TREE-%s", uuid.New().String()[:8]),
		Species:        "pine",
		CreditsTotal:   credits,
		PricePerCredit: 700,
		Status:         "ACTIVE",
		ExpiresAt:      time.Now().AddDate(0, 1, 0),
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}
	if err := db.Create(&listing).Error; err != nil {
		t.Fatal("failed to create listing:", err)
	}
	return listing
}

// ─────────────────────────────────────────────────
// Marketplace payment test helpers
// ─────────────────────────────────────────────────

const testPlatformWallet = "0x000000000000000000000000000000000000dead"

// setupMarketplaceEnv configures a well-formed marketplace environment:
// a real platform wallet and a server-side ETH/INR rate.
func setupMarketplaceEnv(t *testing.T) {
	t.Helper()
	t.Setenv("PLATFORM_WALLET", testPlatformWallet)
	t.Setenv("ETH_INR_RATE", "320000")
}

// stubPaymentVerifier replaces the on-chain payment verification with a
// deterministic stub so the controller can be exercised without an RPC node.
func stubPaymentVerifier(t *testing.T, fn services.PaymentVerificationFunc) {
	t.Helper()
	original := services.PaymentVerifier
	services.PaymentVerifier = fn
	t.Cleanup(func() { services.PaymentVerifier = original })
}

// acceptPayment accepts any payment and records the arguments it was called
// with so a test can assert how the server computed the requirement.
func acceptPayment(t *testing.T) *paymentCall {
	t.Helper()
	call := &paymentCall{}
	stubPaymentVerifier(t, func(txHash, toAddress, fromAddress string, minWei *big.Int) error {
		call.TxHash = txHash
		call.To = toAddress
		call.From = fromAddress
		call.MinWei = minWei
		return nil
	})
	return call
}

type paymentCall struct {
	TxHash string
	To     string
	From   string
	MinWei *big.Int
}

func postBuy(t *testing.T, r *gin.Engine, body map[string]interface{}) *httptest.ResponseRecorder {
	t.Helper()
	raw, _ := json.Marshal(body)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/marketplace/buy", bytes.NewBuffer(raw))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	return w
}

func countTransactions(t *testing.T, db *gorm.DB, listingID uuid.UUID) int64 {
	t.Helper()
	var n int64
	db.Model(&models.MarketplaceTransaction{}).Where("listing_id = ?", listingID).Count(&n)
	return n
}

// ─────────────────────────────────────────────────
// Marketplace purchase tests
// ─────────────────────────────────────────────────

func TestBuyCredits_RejectsDuplicateTxHash(t *testing.T) {
	setupTestEnv(t)
	setupMarketplaceEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)
	r.POST("/api/marketplace/buy", BuyCredits)

	listing := createTestListing(t, db, "0xseller", 10)

	// Seed an existing transaction reusing the same hash.
	txHash := "0xduplicate"
	if err := db.Create(&models.MarketplaceTransaction{
		ID:            uuid.New(),
		ListingID:     listing.ID,
		BuyerWallet:   "0xsomeoneelse",
		SellerWallet:  "0xseller",
		TreeID:        listing.TreeID,
		CreditsAmount: 1,
		TxHash:        txHash,
		Status:        "CONFIRMED",
		CreatedAt:     time.Now(),
	}).Error; err != nil {
		t.Fatal("failed to seed transaction:", err)
	}

	acceptPayment(t)

	w := postBuy(t, r, map[string]interface{}{
		"listing_id":    listing.ID.String(),
		"amount_to_buy": 1,
		"tx_hash":       txHash,
	})

	if w.Code != http.StatusConflict {
		t.Errorf("expected 409 for duplicate tx hash, got %d: %s", w.Code, w.Body.String())
	}
	if n := countTransactions(t, db, listing.ID); n != 1 {
		t.Errorf("expected still exactly 1 transaction (the seeded one), got %d", n)
	}
}

func TestBuyCredits_RequiresPlatformWallet(t *testing.T) {
	setupTestEnv(t)
	// No PLATFORM_WALLET: the endpoint must refuse to settle rather than
	// trusting the client's transaction hash.
	t.Setenv("PLATFORM_WALLET", "")
	t.Setenv("ETH_INR_RATE", "320000")

	db := setupTestDB(t)
	r := setupRouter(db)
	r.POST("/api/marketplace/buy", BuyCredits)

	listing := createTestListing(t, db, "0xseller", 10)
	acceptPayment(t)

	w := postBuy(t, r, map[string]interface{}{
		"listing_id":    listing.ID.String(),
		"amount_to_buy": 2,
		"tx_hash":       "0xfreshhash",
	})

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500 when PLATFORM_WALLET is missing, got %d: %s", w.Code, w.Body.String())
	}
	if n := countTransactions(t, db, listing.ID); n != 0 {
		t.Errorf("expected no transaction to be created, got %d", n)
	}
}

func TestBuyCredits_RequiresConfiguredRate(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("PLATFORM_WALLET", testPlatformWallet)
	// No ETH_INR_RATE: the server cannot compute what the buyer owed, so it
	// must fail closed.
	t.Setenv("ETH_INR_RATE", "")

	db := setupTestDB(t)
	r := setupRouter(db)
	r.POST("/api/marketplace/buy", BuyCredits)

	listing := createTestListing(t, db, "0xseller", 10)
	acceptPayment(t)

	w := postBuy(t, r, map[string]interface{}{
		"listing_id":    listing.ID.String(),
		"amount_to_buy": 2,
		"tx_hash":       "0xfreshhash",
	})

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500 when ETH_INR_RATE is missing, got %d: %s", w.Code, w.Body.String())
	}
	if n := countTransactions(t, db, listing.ID); n != 0 {
		t.Errorf("expected no transaction to be created, got %d", n)
	}
}

func TestBuyCredits_RejectsImplausibleRate(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("PLATFORM_WALLET", testPlatformWallet)
	// A rate far below the accepted band must not make purchases cheap.
	t.Setenv("ETH_INR_RATE", "1")

	db := setupTestDB(t)
	r := setupRouter(db)
	r.POST("/api/marketplace/buy", BuyCredits)

	listing := createTestListing(t, db, "0xseller", 10)
	acceptPayment(t)

	w := postBuy(t, r, map[string]interface{}{
		"listing_id":    listing.ID.String(),
		"amount_to_buy": 2,
		"tx_hash":       "0xfreshhash",
	})

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500 for an implausible rate, got %d: %s", w.Code, w.Body.String())
	}
	if n := countTransactions(t, db, listing.ID); n != 0 {
		t.Errorf("expected no transaction to be created, got %d", n)
	}
}

func TestBuyCredits_RejectsCancelledListing(t *testing.T) {
	setupTestEnv(t)
	setupMarketplaceEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)
	r.POST("/api/marketplace/buy", BuyCredits)

	listing := createTestListing(t, db, "0xseller", 10)
	// A confirmed tree cut cancels the listing; it must not remain buyable.
	db.Model(&models.MarketplaceListing{}).Where("id = ?", listing.ID).Update("status", "CANCELLED")

	acceptPayment(t)

	w := postBuy(t, r, map[string]interface{}{
		"listing_id":    listing.ID.String(),
		"amount_to_buy": 1,
		"tx_hash":       "0xcancelledhash",
	})

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for a cancelled listing, got %d: %s", w.Code, w.Body.String())
	}
	if n := countTransactions(t, db, listing.ID); n != 0 {
		t.Errorf("expected no transaction for a cancelled listing, got %d", n)
	}
}

func TestBuyCredits_RejectsExpiredListing(t *testing.T) {
	setupTestEnv(t)
	setupMarketplaceEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)
	r.POST("/api/marketplace/buy", BuyCredits)

	listing := createTestListing(t, db, "0xseller", 10)
	db.Model(&models.MarketplaceListing{}).Where("id = ?", listing.ID).
		Update("expires_at", time.Now().Add(-time.Hour))

	acceptPayment(t)

	w := postBuy(t, r, map[string]interface{}{
		"listing_id":    listing.ID.String(),
		"amount_to_buy": 1,
		"tx_hash":       "0xexpiredhash",
	})

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for an expired listing, got %d: %s", w.Code, w.Body.String())
	}
	if n := countTransactions(t, db, listing.ID); n != 0 {
		t.Errorf("expected no transaction for an expired listing, got %d", n)
	}
}

func TestBuyCredits_RejectsUnderpaidPayment(t *testing.T) {
	setupTestEnv(t)
	setupMarketplaceEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)
	r.POST("/api/marketplace/buy", BuyCredits)

	listing := createTestListing(t, db, "0xseller", 10)

	stubPaymentVerifier(t, func(txHash, toAddress, fromAddress string, minWei *big.Int) error {
		return fmt.Errorf("underpaid: sent 1 wei, require at least %s wei", minWei)
	})

	w := postBuy(t, r, map[string]interface{}{
		"listing_id":    listing.ID.String(),
		"amount_to_buy": 1,
		"tx_hash":       "0xunderpaidhash",
	})

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for an underpaid purchase, got %d: %s", w.Code, w.Body.String())
	}
	if n := countTransactions(t, db, listing.ID); n != 0 {
		t.Errorf("expected no transaction for an underpaid purchase, got %d", n)
	}
}

func TestBuyCredits_RejectsPaymentFromAnotherWallet(t *testing.T) {
	setupTestEnv(t)
	setupMarketplaceEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)
	r.POST("/api/marketplace/buy", BuyCredits)

	listing := createTestListing(t, db, "0xseller", 10)

	stubPaymentVerifier(t, func(txHash, toAddress, fromAddress string, minWei *big.Int) error {
		return fmt.Errorf("payment sender mismatch: expected %s, got 0xattacker", fromAddress)
	})

	w := postBuy(t, r, map[string]interface{}{
		"listing_id":    listing.ID.String(),
		"amount_to_buy": 1,
		"tx_hash":       "0xwrongsenderhash",
	})

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 when the payment came from another wallet, got %d: %s", w.Code, w.Body.String())
	}
	if n := countTransactions(t, db, listing.ID); n != 0 {
		t.Errorf("expected no transaction for a mismatched sender, got %d", n)
	}
}

func TestBuyCredits_ComputesMinimumPaymentServerSide(t *testing.T) {
	setupTestEnv(t)
	setupMarketplaceEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)
	r.POST("/api/marketplace/buy", BuyCredits)

	listing := createTestListing(t, db, "0xseller", 10)
	call := acceptPayment(t)

	// The client also claims a tiny ETH amount and a huge exchange rate.
	// Neither may influence what the server requires.
	w := postBuy(t, r, map[string]interface{}{
		"listing_id":       listing.ID.String(),
		"amount_to_buy":    2,
		"tx_hash":          "0xserverpricehash",
		"eth_amount":       0.0000001,
		"eth_rate_at_time": 100000000,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	if call.From != "0xtestwallet" {
		t.Errorf("expected the buyer wallet to be checked as the payment sender, got %q", call.From)
	}
	if call.To != testPlatformWallet {
		t.Errorf("expected the platform wallet to be the recipient, got %q", call.To)
	}

	// 2 credits x 700 INR = 1400 INR; at 320000 INR/ETH that is 0.004375 ETH.
	expectedWei := services.EthToWei(1400.0 / 320000.0)
	if call.MinWei == nil || call.MinWei.Cmp(expectedWei) != 0 {
		t.Errorf("expected minimum payment %s wei, got %v", expectedWei, call.MinWei)
	}

	// The dust claim must not have been honoured.
	if call.MinWei.Cmp(services.EthToWei(0.0000001)) <= 0 {
		t.Errorf("the client-supplied dust amount was accepted as the minimum: %s wei", call.MinWei)
	}
}

func TestBuyCredits_RejectsNonPositiveAmount(t *testing.T) {
	setupTestEnv(t)
	setupMarketplaceEnv(t)

	for _, amount := range []float64{0, -1, -0.5} {
		t.Run(fmt.Sprintf("amount=%v", amount), func(t *testing.T) {
			db := setupTestDB(t)
			r := setupRouter(db)
			r.POST("/api/marketplace/buy", BuyCredits)

			listing := createTestListing(t, db, "0xseller", 10)
			acceptPayment(t)

			w := postBuy(t, r, map[string]interface{}{
				"listing_id":    listing.ID.String(),
				"amount_to_buy": amount,
				"tx_hash":       "0xnonpositivehash",
			})

			if w.Code != http.StatusBadRequest {
				t.Errorf("expected 400 for amount %v, got %d: %s", amount, w.Code, w.Body.String())
			}

			// Invalid requests must not create transactions or change balances.
			if n := countTransactions(t, db, listing.ID); n != 0 {
				t.Errorf("expected no transaction for amount %v, got %d", amount, n)
			}

			var reloaded models.MarketplaceListing
			if err := db.First(&reloaded, "id = ?", listing.ID).Error; err != nil {
				t.Fatal("failed to reload listing:", err)
			}
			if reloaded.CreditsSold != 0 {
				t.Errorf("expected credits_sold to stay 0 for amount %v, got %v", amount, reloaded.CreditsSold)
			}
		})
	}
}

func TestBuyCredits_RejectsAmountExceedingAvailability(t *testing.T) {
	setupTestEnv(t)
	setupMarketplaceEnv(t)

	db := setupTestDB(t)
	r := setupRouter(db)
	r.POST("/api/marketplace/buy", BuyCredits)

	listing := createTestListing(t, db, "0xseller", 10)
	acceptPayment(t)

	w := postBuy(t, r, map[string]interface{}{
		"listing_id":    listing.ID.String(),
		"amount_to_buy": 11,
		"tx_hash":       "0xoveramount",
	})

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for over-availability, got %d: %s", w.Code, w.Body.String())
	}

	if n := countTransactions(t, db, listing.ID); n != 0 {
		t.Errorf("expected no transaction for over-availability, got %d", n)
	}
}

func TestBuyCredits_ValidPurchaseUpdatesListing(t *testing.T) {
	setupTestEnv(t)
	setupMarketplaceEnv(t)

	db := setupTestDB(t)
	r := setupRouter(db)
	r.POST("/api/marketplace/buy", BuyCredits)

	listing := createTestListing(t, db, "0xseller", 10)
	acceptPayment(t)

	w := postBuy(t, r, map[string]interface{}{
		"listing_id":    listing.ID.String(),
		"amount_to_buy": 4,
		"tx_hash":       "0xvalidhash",
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid purchase, got %d: %s", w.Code, w.Body.String())
	}

	var reloaded models.MarketplaceListing
	if err := db.First(&reloaded, "id = ?", listing.ID).Error; err != nil {
		t.Fatal("failed to reload listing:", err)
	}
	if reloaded.CreditsSold != 4 {
		t.Errorf("expected credits_sold 4, got %v", reloaded.CreditsSold)
	}
	if reloaded.Status != "PARTIAL" {
		t.Errorf("expected status PARTIAL, got %s", reloaded.Status)
	}

	if n := countTransactions(t, db, listing.ID); n != 1 {
		t.Errorf("expected 1 transaction for valid purchase, got %d", n)
	}
}

func TestBuyCredits_PartiallySoldListingRemainsBuyable(t *testing.T) {
	setupTestEnv(t)
	setupMarketplaceEnv(t)

	db := setupTestDB(t)
	r := setupRouter(db)
	r.POST("/api/marketplace/buy", BuyCredits)

	listing := createTestListing(t, db, "0xseller", 10)
	// A listing that has already sold part of its credits is still open.
	db.Model(&models.MarketplaceListing{}).Where("id = ?", listing.ID).
		Updates(map[string]interface{}{"credits_sold": 3, "status": "PARTIAL"})

	acceptPayment(t)

	w := postBuy(t, r, map[string]interface{}{
		"listing_id":    listing.ID.String(),
		"amount_to_buy": 2,
		"tx_hash":       "0xpartialhash",
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for a partially sold listing, got %d: %s", w.Code, w.Body.String())
	}
}

// ─────────────────────────────────────────────────
// Marketplace listing tests
// ─────────────────────────────────────────────────

func postCreateListing(t *testing.T, r *gin.Engine, body map[string]interface{}) *httptest.ResponseRecorder {
	t.Helper()
	raw, _ := json.Marshal(body)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/marketplace/listings", bytes.NewBuffer(raw))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	return w
}

func createListableTree(t *testing.T, db *gorm.DB, wallet string, available float64) models.Tree {
	t.Helper()
	user := createTestUser(t, db, wallet, "user")
	tree := models.Tree{
		ID:                   uuid.New(),
		TreeID:               fmt.Sprintf("TREE-%s", uuid.New().String()[:8]),
		PlanterID:            user.ID,
		Species:              "oak",
		OwnerWallet:          wallet,
		Latitude:             28.6139,
		Longitude:            77.2090,
		Status:               "VERIFIED",
		CarbonAbsorptionRate: 20.0,
		PlantedAt:            time.Now().AddDate(0, -3, 0),
		HealthStatus:         "Healthy",
		CreditsAvailable:     available,
	}
	if err := db.Create(&tree).Error; err != nil {
		t.Fatal("failed to create tree:", err)
	}
	return tree
}

func TestCreateMarketplaceListing_RejectsNonPositiveCredits(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)
	r.POST("/api/marketplace/listings", CreateMarketplaceListing)

	tree := createListableTree(t, db, "0xtestwallet", 10)

	for _, amount := range []float64{0, -1, -0.5} {
		w := postCreateListing(t, r, map[string]interface{}{
			"tree_id":          tree.TreeID,
			"credits_to_sell":  amount,
			"price_per_credit": 700,
			"duration_days":    14,
		})
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400 for credits_to_sell=%v, got %d: %s", amount, w.Code, w.Body.String())
		}
	}

	// A negative amount must never inflate the seller's balance.
	var reloaded models.Tree
	db.First(&reloaded, "id = ?", tree.ID)
	if reloaded.CreditsAvailable != 10 {
		t.Errorf("expected credits_available to stay 10, got %v", reloaded.CreditsAvailable)
	}
	var listings int64
	db.Model(&models.MarketplaceListing{}).Count(&listings)
	if listings != 0 {
		t.Errorf("expected no listings to be created, got %d", listings)
	}
}

func TestCreateMarketplaceListing_RejectsExceedingAvailable(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)
	r.POST("/api/marketplace/listings", CreateMarketplaceListing)

	tree := createListableTree(t, db, "0xtestwallet", 10)

	w := postCreateListing(t, r, map[string]interface{}{
		"tree_id":          tree.TreeID,
		"credits_to_sell":  11,
		"price_per_credit": 700,
		"duration_days":    14,
	})

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for exceeding available credits, got %d: %s", w.Code, w.Body.String())
	}

	var reloaded models.Tree
	db.First(&reloaded, "id = ?", tree.ID)
	if reloaded.CreditsAvailable != 10 {
		t.Errorf("expected credits_available to stay 10, got %v", reloaded.CreditsAvailable)
	}
}

func TestCreateMarketplaceListing_RejectsSellerWithOpenDebt(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)
	r.POST("/api/marketplace/listings", CreateMarketplaceListing)

	tree := createListableTree(t, db, "0xtestwallet", 10)
	db.Create(&models.ReplantationDebt{
		ID:             uuid.New(),
		OriginalTreeID: "TREE-CUT-1",
		OwnerWallet:    "0xtestwallet",
		TreesNeeded:    3,
		Status:         "PENDING",
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	})

	w := postCreateListing(t, r, map[string]interface{}{
		"tree_id":          tree.TreeID,
		"credits_to_sell":  1,
		"price_per_credit": 700,
		"duration_days":    14,
	})

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for a seller with an open debt, got %d: %s", w.Code, w.Body.String())
	}

	var listings int64
	db.Model(&models.MarketplaceListing{}).Count(&listings)
	if listings != 0 {
		t.Errorf("expected no listing to be created while in debt, got %d", listings)
	}
}

func TestCreateMarketplaceListing_AllowsSellerWithClearedDebt(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)
	r.POST("/api/marketplace/listings", CreateMarketplaceListing)

	tree := createListableTree(t, db, "0xtestwallet", 10)
	db.Create(&models.ReplantationDebt{
		ID:             uuid.New(),
		OriginalTreeID: "TREE-CUT-1",
		OwnerWallet:    "0xtestwallet",
		TreesNeeded:    3,
		TreesVerified:  3,
		Status:         "CLEARED",
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	})

	w := postCreateListing(t, r, map[string]interface{}{
		"tree_id":          tree.TreeID,
		"credits_to_sell":  2,
		"price_per_credit": 700,
		"duration_days":    14,
	})

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for a seller whose debt is cleared, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCreateMarketplaceListing_ValidListingMovesCredits(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)
	r.POST("/api/marketplace/listings", CreateMarketplaceListing)

	tree := createListableTree(t, db, "0xtestwallet", 10)

	w := postCreateListing(t, r, map[string]interface{}{
		"tree_id":          tree.TreeID,
		"credits_to_sell":  4,
		"price_per_credit": 700,
		"duration_days":    14,
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var reloaded models.Tree
	db.First(&reloaded, "id = ?", tree.ID)
	if reloaded.CreditsAvailable != 6 {
		t.Errorf("expected credits_available 6, got %v", reloaded.CreditsAvailable)
	}
	if reloaded.CreditsListed != 4 {
		t.Errorf("expected credits_listed 4, got %v", reloaded.CreditsListed)
	}
}

func TestBuyCredits_UniqueIndexRejectsDuplicateTxHashAtDatabaseLevel(t *testing.T) {
	setupTestEnv(t)
	setupMarketplaceEnv(t)
	db := setupTestDB(t)

	// The replay guard must be enforced by the database, not by application
	// logic, so that two concurrent requests carrying the same hash cannot
	// both succeed.
	var indexSQL string
	if err := db.Raw(`SELECT sql FROM sqlite_master WHERE type='index' AND name='uni_marketplace_transactions_tx_hash'`).
		Scan(&indexSQL).Error; err != nil {
		t.Fatalf("failed to look up the index: %v", err)
	}
	if indexSQL == "" {
		t.Fatal("expected a unique index on marketplace_transactions.tx_hash to exist")
	}
	if !strings.Contains(indexSQL, "UNIQUE") {
		t.Errorf("expected the index to be UNIQUE, got: %s", indexSQL)
	}

	// And the constraint must actually reject a duplicate hash.
	base := models.MarketplaceTransaction{
		ID:            uuid.New(),
		ListingID:     uuid.New(),
		BuyerWallet:   "0xbuyer",
		SellerWallet:  "0xseller",
		TreeID:        "TREE-X",
		CreditsAmount: 1,
		TxHash:        "0xreplayed",
		Status:        "CONFIRMED",
		CreatedAt:     time.Now(),
	}
	if err := db.Create(&base).Error; err != nil {
		t.Fatalf("failed to insert the first transaction: %v", err)
	}

	dup := base
	dup.ID = uuid.New()
	err := db.Create(&dup).Error
	if err == nil {
		t.Fatal("expected the duplicate tx_hash to be rejected by the database")
	}
	if !errors.Is(err, gorm.ErrDuplicatedKey) {
		t.Errorf("expected gorm.ErrDuplicatedKey, got %v", err)
	}
}

func TestGetMarketplacePaymentConfig_PublishesServerSideRate(t *testing.T) {
	setupTestEnv(t)
	setupMarketplaceEnv(t)
	db := setupTestDB(t)
	r := setupRouter(db)
	r.GET("/api/marketplace/payment-config", GetMarketplacePaymentConfig)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/marketplace/payment-config", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var cfg map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &cfg); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if cfg["eth_inr_rate"] != float64(320000) {
		t.Errorf("expected eth_inr_rate 320000, got %v", cfg["eth_inr_rate"])
	}
	if cfg["platform_wallet"] != testPlatformWallet {
		t.Errorf("expected platform_wallet %s, got %v", testPlatformWallet, cfg["platform_wallet"])
	}
	if cfg["configured"] != true {
		t.Errorf("expected configured true, got %v", cfg["configured"])
	}
}

func TestGetMarketplacePaymentConfig_ReportsUnconfiguredPricing(t *testing.T) {
	setupTestEnv(t)
	t.Setenv("PLATFORM_WALLET", testPlatformWallet)
	t.Setenv("ETH_INR_RATE", "")

	db := setupTestDB(t)
	r := setupRouter(db)
	r.GET("/api/marketplace/payment-config", GetMarketplacePaymentConfig)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/marketplace/payment-config", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503 when pricing is unconfigured, got %d: %s", w.Code, w.Body.String())
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
