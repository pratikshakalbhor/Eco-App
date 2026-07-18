package controllers

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetMarketplaceListings — GET /api/marketplace/listings
func GetMarketplaceListings(c *gin.Context) {
	status := c.DefaultQuery("status", "ACTIVE")
	sort := c.DefaultQuery("sort", "price_asc")
	species := c.Query("species")

	query := config.DB.Model(&models.MarketplaceListing{}).Preload("Tree").Where("status = ?", status)

	if species != "" && species != "All" {
		query = query.Where("species = ?", species)
	}

	switch sort {
	case "price_asc":
		query = query.Order("price_per_credit asc")
	case "price_desc":
		query = query.Order("price_per_credit desc")
	default:
		query = query.Order("created_at desc")
	}

	var listings []models.MarketplaceListing
	if err := query.Find(&listings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch listings"})
		return
	}

	c.JSON(http.StatusOK, listings)
}

// CreateMarketplaceListing — POST /api/marketplace/listings
func CreateMarketplaceListing(c *gin.Context) {
	var input struct {
		TreeID         string  `json:"tree_id" binding:"required"`
		CreditsToSell  float64 `json:"credits_to_sell" binding:"required"`
		PricePerCredit float64 `json:"price_per_credit" binding:"required"`
		DurationDays   int     `json:"duration_days" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	walletAddress, _ := c.Get("walletAddress")

	var tree models.Tree
	if err := config.DB.Where("tree_id = ? AND owner_wallet = ?", input.TreeID, walletAddress).First(&tree).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tree not found or does not belong to you"})
		return
	}

	if tree.Status != "VERIFIED" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only verified trees can list credits"})
		return
	}

	// Calculate available credits: Available = TotalEarned - CreditsListed - CreditsSold
	// For simplicity, we check the available field in the tree model
	if tree.CreditsAvailable < input.CreditsToSell {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient credits available"})
		return
	}

	tx := config.DB.Begin()

	listing := models.MarketplaceListing{
		ID:             uuid.New(),
		SellerWallet:   fmt.Sprintf("%v", walletAddress),
		TreeID:         input.TreeID,
		Species:        tree.Species,
		CreditsTotal:   input.CreditsToSell,
		PricePerCredit: input.PricePerCredit,
		Status:         "ACTIVE",
		ExpiresAt:      time.Now().AddDate(0, 0, input.DurationDays),
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := tx.Create(&listing).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create listing"})
		return
	}

	// Update tree credits
	if err := tx.Model(&tree).Updates(map[string]interface{}{
		"credits_available": tree.CreditsAvailable - input.CreditsToSell,
		"credits_listed":    tree.CreditsListed + input.CreditsToSell,
	}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update tree credits"})
		return
	}

	tx.Commit()

	// Update Ledger for Seller
	var currentBalance float64
	config.DB.Model(&models.MarketplaceListing{}).Where("seller_wallet = ?", listing.SellerWallet).Select("SUM(credits_total - credits_sold)").Scan(&currentBalance) // Simplified balance check
	RecordCreditEvent(listing.SellerWallet, tree.TreeID, "LISTED", input.CreditsToSell, currentBalance, listing.ID.String())

	LogActivity("CREDIT_LISTED", tree.TreeID, nil, listing.SellerWallet, fmt.Sprintf("Listed %.3f credits for sale at ₹%.2f/cr", input.CreditsToSell, input.PricePerCredit))

	c.JSON(http.StatusOK, listing)
}

// BuyCredits — POST /api/marketplace/buy
func BuyCredits(c *gin.Context) {
	var input struct {
		ListingID     string  `json:"listing_id" binding:"required"`
		AmountToBuy   float64 `json:"amount_to_buy" binding:"required"`
		TxHash        string  `json:"tx_hash" binding:"required"`
		EthAmount     float64 `json:"eth_amount"`
		EthRateAtTime float64 `json:"eth_rate_at_time"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	buyerWallet, _ := c.Get("walletAddress")

	var listing models.MarketplaceListing
	if err := config.DB.First(&listing, "id = ?", input.ListingID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Listing not found"})
		return
	}

	if listing.SellerWallet == fmt.Sprintf("%v", buyerWallet) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot buy your own listing"})
		return
	}

	availableInListing := listing.CreditsTotal - listing.CreditsSold
	if availableInListing < input.AmountToBuy {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient credits available in listing"})
		return
	}

	tx := config.DB.Begin()

	totalINR := input.AmountToBuy * listing.PricePerCredit
	fee := totalINR * 0.02
	sellerReceived := totalINR - fee

	transaction := models.MarketplaceTransaction{
		ID:                uuid.New(),
		ListingID:         listing.ID,
		BuyerWallet:       fmt.Sprintf("%v", buyerWallet),
		SellerWallet:      listing.SellerWallet,
		TreeID:            listing.TreeID,
		CreditsAmount:     input.AmountToBuy,
		PricePerCreditINR: listing.PricePerCredit,
		TotalINR:          totalINR,
		PlatformFeeINR:    fee,
		SellerReceivedINR: sellerReceived,
		EthAmount:         input.EthAmount,
		EthRateAtTime:     input.EthRateAtTime,
		TxHash:            input.TxHash,
		Status:            "CONFIRMED",
		CreatedAt:         time.Now(),
	}

	if err := tx.Create(&transaction).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record transaction"})
		return
	}

	// Update listing
	newSold := listing.CreditsSold + input.AmountToBuy
	listingStatus := "PARTIAL"
	if newSold >= listing.CreditsTotal {
		listingStatus = "SOLD"
	}

	if err := tx.Model(&listing).Updates(map[string]interface{}{
		"credits_sold": newSold,
		"status":       listingStatus,
		"updated_at":   time.Now(),
	}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update listing"})
		return
	}

	// Update tree credits for seller
	var tree models.Tree
	if err := tx.First(&tree, "tree_id = ?", listing.TreeID).Error; err == nil {
		tx.Model(&tree).Updates(map[string]interface{}{
			"credits_listed": tree.CreditsListed - input.AmountToBuy,
			"credits_sold":   tree.CreditsSold + input.AmountToBuy,
		})
	}

	tx.Commit()

	// Update Ledgers
	RecordCreditEvent(transaction.BuyerWallet, listing.TreeID, "BOUGHT", input.AmountToBuy, 0, transaction.ID.String()) // BalanceAfter omitted for brevity or calculated elsewhere
	RecordCreditEvent(listing.SellerWallet, listing.TreeID, "SOLD", input.AmountToBuy, 0, transaction.ID.String())

	LogActivity("CREDIT_SOLD", listing.TreeID, nil, listing.SellerWallet, fmt.Sprintf("Sold %.3f credits for ₹%.2f", input.AmountToBuy, totalINR))
	LogActivity("CREDIT_BOUGHT", listing.TreeID, nil, transaction.BuyerWallet, fmt.Sprintf("Bought %.3f credits for ₹%.2f", input.AmountToBuy, totalINR))

	c.JSON(http.StatusOK, transaction)
}

// GetMarketplaceStats — GET /api/marketplace/stats
func GetMarketplaceStats(c *gin.Context) {
	var stats struct {
		AvgPrice       float64 `json:"avg_price"`
		Volume24h      float64 `json:"volume_24h"`
		ActiveListings int64   `json:"active_listings"`
		TotalTraded    float64 `json:"total_traded"`
	}

	config.DB.Model(&models.MarketplaceListing{}).Where("status = ?", "ACTIVE").Count(&stats.ActiveListings)
	
	config.DB.Model(&models.MarketplaceListing{}).
		Where("status IN ?", []string{"ACTIVE", "PARTIAL", "SOLD"}).
		Select("AVG(price_per_credit)").Scan(&stats.AvgPrice)

	yesterday := time.Now().AddDate(0, 0, -1)
	config.DB.Model(&models.MarketplaceTransaction{}).
		Where("created_at >= ?", yesterday).
		Select("SUM(credits_amount)").Scan(&stats.Volume24h)

	config.DB.Model(&models.MarketplaceTransaction{}).
		Select("SUM(total_inr)").Scan(&stats.TotalTraded)

	c.JSON(http.StatusOK, stats)
}

// GetTransactions — GET /api/marketplace/transactions
func GetTransactions(c *gin.Context) {
	walletAddress, _ := c.Get("walletAddress")

	var transactions []models.MarketplaceTransaction
	if err := config.DB.
		Where("buyer_wallet = ? OR seller_wallet = ?", walletAddress, walletAddress).
		Order("created_at desc").
		Find(&transactions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch transactions"})
		return
	}

	c.JSON(http.StatusOK, transactions)
}
