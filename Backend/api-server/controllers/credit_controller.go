package controllers

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetCreditBalance — GET /api/credits/balance
func GetCreditBalance(c *gin.Context) {
	walletAddressRaw, exists := c.Get("walletAddress")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Wallet not connected"})
		return
	}
	walletAddress := fmt.Sprintf("%v", walletAddressRaw)

	var balance struct {
		Earned    float64 `json:"total_earned"`
		Sold      float64 `json:"total_sold"`
		Bought    float64 `json:"total_bought"`
		Listed    float64 `json:"currently_listed"`
		Frozen    float64 `json:"frozen"`
		Available float64 `json:"available"`
	}

	// 1. Calculate Earned (from verified trees)
	config.DB.Model(&models.CarbonCredit{}).
		Where("user_id = (SELECT id FROM users WHERE wallet_address = ?) AND amount > 0 AND tradeable = ?", walletAddress, true).
		Select("COALESCE(SUM(amount), 0)").Scan(&balance.Earned)

	// 2. Calculate Sold
	config.DB.Model(&models.MarketplaceTransaction{}).
		Where("seller_wallet = ? AND status = ?", walletAddress, "CONFIRMED").
		Select("COALESCE(SUM(credits_amount), 0)").Scan(&balance.Sold)

	// 3. Calculate Bought
	config.DB.Model(&models.MarketplaceTransaction{}).
		Where("buyer_wallet = ? AND status = ?", walletAddress, "CONFIRMED").
		Select("COALESCE(SUM(credits_amount), 0)").Scan(&balance.Bought)

	// 4. Calculate Currently Listed
	config.DB.Model(&models.MarketplaceListing{}).
		Where("seller_wallet = ? AND status IN ?", walletAddress, []string{"ACTIVE", "PARTIAL"}).
		Select("COALESCE(SUM(credits_total - credits_sold), 0)").Scan(&balance.Listed)

	// 5. Calculate Frozen (credits for trees that were cut and debt not yet cleared)
	config.DB.Model(&models.CarbonCredit{}).
		Where("user_id = (SELECT id FROM users WHERE wallet_address = ?) AND tradeable = ?", walletAddress, false).
		Select("COALESCE(SUM(amount), 0)").Scan(&balance.Frozen)

	// Final Available Balance
	balance.Available = balance.Earned + balance.Bought - balance.Sold - balance.Listed

	c.JSON(http.StatusOK, balance)
}

// GetCreditHistory — GET /api/credits/history
func GetCreditHistory(c *gin.Context) {
	walletAddressRaw, exists := c.Get("walletAddress")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Wallet not connected"})
		return
	}
	walletAddress := fmt.Sprintf("%v", walletAddressRaw)

	history := make([]models.CreditLedger, 0)
	if err := config.DB.Where("wallet = ?", walletAddress).Order("created_at desc").Find(&history).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch credit history"})
		return
	}

	c.JSON(http.StatusOK, history)
}

// Helper to update credit ledger
func RecordCreditEvent(wallet, treeID, eventType string, amount, balanceAfter float64, refID string) {
	event := models.CreditLedger{
		Wallet:       wallet,
		TreeID:       treeID,
		EventType:    eventType,
		Amount:       amount,
		BalanceAfter: balanceAfter,
		ReferenceID:  refID,
	}
	config.DB.Create(&event)
}
