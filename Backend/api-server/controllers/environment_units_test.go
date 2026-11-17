package controllers

import (
	"encoding/json"
	"math"
	"net/http"
	"testing"
	"time"

	"ecochain-backend/models"

	"github.com/google/uuid"
)

type environmentStats struct {
	TotalCO2Absorbed       float64 `json:"total_co2_absorbed"`
	TotalCO2Lost           float64 `json:"total_co2_lost"`
	NetCO2Balance          float64 `json:"net_co2_balance"`
	CarbonCreditsGenerated float64 `json:"carbon_credits_generated"`
	CarbonCreditsBurned    float64 `json:"carbon_credits_burned"`
	CO2Offset              float64 `json:"co2_offset"`
}

func closeEnough(a, b float64) bool {
	return math.Abs(a-b) < 1e-6
}

// The regression this guards: one credit is 1000 kg of CO2e, not 1 kg. The
// endpoint used to add the credits column straight to a kg column.
func TestGetEnvironmentStats_ReportsEveryCO2FigureInKilograms(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	user := createTestUser(t, db, "0xenv", "user")
	tree := createTestTree(t, db, user.ID, "VERIFIED", "oak")
	db.Model(&tree).Update("blockchain_token_id", "55")

	db.Create(&models.CarbonCredit{
		ID: uuid.New(), UserID: user.ID, TreeID: tree.ID,
		Amount: 1.0, Type: "verification_reward", TransactionHash: "0xenv1",
	})
	db.Create(&models.CarbonCredit{
		ID: uuid.New(), UserID: user.ID, TreeID: uuid.Nil,
		Amount: -0.5, Type: "burned", TransactionHash: "0xenv2",
	})
	db.Create(&models.CreditLedger{
		ID: uuid.New(), Wallet: user.WalletAddress, EventType: "BURNED",
		Amount: -0.5, BalanceAfter: 0.5, CreatedAt: time.Now(),
	})
	db.Create(&models.EnvironmentalLoss{
		ID: uuid.New(), TreeID: tree.TreeID, CO2LostKg: 500, CalculatedAt: time.Now(),
	})

	r := setupIntegrityRouter(user.ID, user.WalletAddress)
	r.GET("/api/environment/stats", GetEnvironmentStats)

	w := postJSONTo(t, r, "GET", "/api/environment/stats", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var stats environmentStats
	if err := json.Unmarshal(w.Body.Bytes(), &stats); err != nil {
		t.Fatal("failed to decode response:", err)
	}

	if !closeEnough(stats.CarbonCreditsGenerated, 1) {
		t.Errorf("expected 1 credit generated, got %v", stats.CarbonCreditsGenerated)
	}
	if !closeEnough(stats.TotalCO2Absorbed, 1000) {
		t.Errorf("expected 1 credit to report as 1000 kg absorbed, got %v", stats.TotalCO2Absorbed)
	}
	if !closeEnough(stats.TotalCO2Lost, 500) {
		t.Errorf("expected 500 kg lost, got %v", stats.TotalCO2Lost)
	}
	if !closeEnough(stats.NetCO2Balance, 500) {
		t.Errorf("expected a 500 kg net balance, got %v", stats.NetCO2Balance)
	}
	if !closeEnough(stats.CarbonCreditsBurned, 0.5) {
		t.Errorf("expected 0.5 credits burned, got %v", stats.CarbonCreditsBurned)
	}
	if !closeEnough(stats.CO2Offset, 500) {
		t.Errorf("expected 0.5 credits to report as 500 kg offset, got %v", stats.CO2Offset)
	}
}

func TestGetEnvironmentStats_NetBalanceIsNegativeWhenLossesExceedAbsorption(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	user := createTestUser(t, db, "0xenv2", "user")
	tree := createTestTree(t, db, user.ID, "VERIFIED", "oak")
	db.Create(&models.CarbonCredit{
		ID: uuid.New(), UserID: user.ID, TreeID: tree.ID,
		Amount: 0.2, Type: "verification_reward", TransactionHash: "0xenv3",
	})
	db.Create(&models.EnvironmentalLoss{
		ID: uuid.New(), TreeID: tree.TreeID, CO2LostKg: 500, CalculatedAt: time.Now(),
	})

	r := setupIntegrityRouter(user.ID, user.WalletAddress)
	r.GET("/api/environment/stats", GetEnvironmentStats)

	w := postJSONTo(t, r, "GET", "/api/environment/stats", nil)
	var stats environmentStats
	json.Unmarshal(w.Body.Bytes(), &stats)

	// 0.2 credits = 200 kg absorbed, minus 500 kg lost.
	if !closeEnough(stats.NetCO2Balance, -300) {
		t.Errorf("expected a -300 kg balance, got %v", stats.NetCO2Balance)
	}
}

func TestGetMonthlyStats_CurrentMonthUsesKilograms(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	user := createTestUser(t, db, "0xmonthly", "user")
	tree := createTestTree(t, db, user.ID, "VERIFIED", "oak")

	now := time.Now()
	db.Create(&models.CarbonCredit{
		ID: uuid.New(), UserID: user.ID, TreeID: tree.ID,
		Amount: 1, Type: "verification_reward", TransactionHash: "0xmonthly1",
		CreatedAt: now,
	})
	db.Create(&models.EnvironmentalLoss{
		ID: uuid.New(), TreeID: tree.TreeID, CO2LostKg: 250, CalculatedAt: now,
	})

	r := setupIntegrityRouter(user.ID, user.WalletAddress)
	r.GET("/api/environment/monthly-stats", GetMonthlyStats)

	w := postJSONTo(t, r, "GET", "/api/environment/monthly-stats", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var months []struct {
		Month    string  `json:"month"`
		Absorbed float64 `json:"absorbed"`
		Lost     float64 `json:"lost"`
		Net      float64 `json:"net"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &months); err != nil {
		t.Fatal("failed to decode response:", err)
	}
	if len(months) != 12 {
		t.Fatalf("expected 12 months, got %d", len(months))
	}

	current := months[len(months)-1]
	if !closeEnough(current.Absorbed, 1000) {
		t.Errorf("expected the current month's 1 credit to be 1000 kg, got %v", current.Absorbed)
	}
	if !closeEnough(current.Lost, 250) {
		t.Errorf("expected 250 kg lost, got %v", current.Lost)
	}
	if !closeEnough(current.Net, 750) {
		t.Errorf("expected a 750 kg net, got %v", current.Net)
	}
}

func TestGetSpeciesStats_ConvertsCreditsAndAvoidsJoinFanOut(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	user := createTestUser(t, db, "0xspecies", "user")
	tree := createTestTree(t, db, user.ID, "VERIFIED", "oak")

	// Two credit rows and two loss rows on the same tree. Joining both tables
	// at once would multiply them into four of each.
	db.Create(&models.CarbonCredit{
		ID: uuid.New(), UserID: user.ID, TreeID: tree.ID,
		Amount: 1, Type: "verification_reward", TransactionHash: "0xspecies1",
	})
	db.Create(&models.CarbonCredit{
		ID: uuid.New(), UserID: user.ID, TreeID: tree.ID,
		Amount: 1, Type: "minted", TransactionHash: "0xspecies2",
	})
	db.Create(&models.EnvironmentalLoss{
		ID: uuid.New(), TreeID: tree.TreeID, CO2LostKg: 100, CalculatedAt: time.Now(),
	})
	db.Create(&models.EnvironmentalLoss{
		ID: uuid.New(), TreeID: tree.TreeID, CO2LostKg: 200, CalculatedAt: time.Now(),
	})

	r := setupIntegrityRouter(user.ID, user.WalletAddress)
	r.GET("/api/environment/species-stats", GetSpeciesStats)

	w := postJSONTo(t, r, "GET", "/api/environment/species-stats", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var stats []struct {
		Species     string  `json:"species"`
		Planted     int64   `json:"planted"`
		CO2Absorbed float64 `json:"co2_absorbed"`
		CO2Lost     float64 `json:"co2_lost"`
		Net         float64 `json:"net"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &stats); err != nil {
		t.Fatal("failed to decode response:", err)
	}
	if len(stats) != 1 {
		t.Fatalf("expected 1 species, got %d", len(stats))
	}
	if !closeEnough(stats[0].CO2Absorbed, 2000) {
		t.Errorf("expected 2 credits to be 2000 kg without fan-out, got %v", stats[0].CO2Absorbed)
	}
	if !closeEnough(stats[0].CO2Lost, 300) {
		t.Errorf("expected 300 kg lost without fan-out, got %v", stats[0].CO2Lost)
	}
	if !closeEnough(stats[0].Net, 1700) {
		t.Errorf("expected a 1700 kg net, got %v", stats[0].Net)
	}
}
