package controllers

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"ecochain-backend/services"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// lockRow applies a SELECT ... FOR UPDATE row lock to the query it is chained
// onto. The SQLite dialect used for local development and the test-suite has
// no row-level locking and silently drops the clause, so this is safe to call
// unconditionally; on PostgreSQL it serialises concurrent buyers of the same
// listing.
func lockRow(tx *gorm.DB) *gorm.DB {
	return tx.Clauses(clause.Locking{Strength: clause.LockingStrengthUpdate})
}

// isUniqueViolation reports whether err is a database unique-constraint
// violation. It relies on GORM's error translation, which maps the native
// "duplicate key" errors of PostgreSQL and SQLite onto gorm.ErrDuplicatedKey.
func isUniqueViolation(err error) bool {
	return errors.Is(err, gorm.ErrDuplicatedKey)
}

// validateListingPurchasable rejects a listing that may no longer be bought.
//
// A listing is open while it is ACTIVE, or PARTIAL (some credits already sold
// but the remainder is still on offer). Everything else — most importantly
// CANCELLED, which is what a confirmed tree cut sets — is closed, and a
// listing whose expiry has passed is closed as well.
func validateListingPurchasable(l *models.MarketplaceListing) error {
	switch l.Status {
	case "ACTIVE", "PARTIAL":
	default:
		return fmt.Errorf("listing is not open for purchase (status %q)", l.Status)
	}
	if !l.ExpiresAt.IsZero() && !l.ExpiresAt.After(time.Now()) {
		return fmt.Errorf("listing expired at %s", l.ExpiresAt.UTC().Format(time.RFC3339))
	}
	return nil
}

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
		TreeID string `json:"tree_id" binding:"required"`
		// credits_to_sell must be strictly positive. `required` alone only
		// rejects the zero value, so a negative amount used to pass validation
		// and *increase* the seller's available credits.
		CreditsToSell float64 `json:"credits_to_sell" binding:"required,gt=0"`
		// A negative price would let a buyer pay the seller.
		PricePerCredit float64 `json:"price_per_credit" binding:"required,gt=0"`
		// A non-positive duration produced an already-expired listing.
		DurationDays int `json:"duration_days" binding:"required,gt=0"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	walletAddress, _ := c.Get("walletAddress")
	sellerWallet := fmt.Sprintf("%v", walletAddress)

	// A planter carrying an unresolved replantation debt may not list credits.
	// The whole point of the Replantation Debt framework is that the debtor's
	// carbon assets stay locked until the replacement trees have been audited.
	var openDebts int64
	config.DB.Model(&models.ReplantationDebt{}).
		Where("owner_wallet = ? AND status <> ?", sellerWallet, "CLEARED").
		Count(&openDebts)
	if openDebts > 0 {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "You have an unresolved replantation debt. Your carbon assets are frozen until the replacement trees are verified.",
			"debts": openDebts,
		})
		return
	}

	tx := config.DB.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}

	// Lock the tree row so two concurrent listings cannot both spend the same
	// credits_available balance.
	var tree models.Tree
	if err := lockRow(tx).
		Where("tree_id = ? AND owner_wallet = ?", input.TreeID, sellerWallet).
		First(&tree).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "Tree not found or does not belong to you"})
		return
	}

	if tree.Status != "VERIFIED" {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only verified trees can list credits"})
		return
	}

	// The available balance is re-read under the row lock so the check and the
	// debit below cannot be interleaved with another listing.
	if input.CreditsToSell > tree.CreditsAvailable {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{
			"error":     "Insufficient credits available",
			"available": tree.CreditsAvailable,
			"requested": input.CreditsToSell,
		})
		return
	}

	listing := models.MarketplaceListing{
		ID:             uuid.New(),
		SellerWallet:   sellerWallet,
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
//
// Settlement is deliberately split into two phases:
//
//  1. Validation and payment verification happen BEFORE the database
//     transaction, so the row lock is never held across a network round trip.
//  2. The critical section — lock the listing, re-validate it, insert the
//     transaction and move the credits — happens inside a single transaction
//     with a SELECT ... FOR UPDATE row lock.
//
// The payment amount is always derived from the server-side price
// (services.MinimumPaymentWei). The client's claimed ETH amount and exchange
// rate are never used.
func BuyCredits(c *gin.Context) {
	var input struct {
		ListingID string `json:"listing_id" binding:"required"`
		// A purchase must be for a strictly positive amount. `binding:"required"`
		// only rejects the zero value, so negative amounts would otherwise pass
		// and corrupt listing/tree credit accounting.
		AmountToBuy float64 `json:"amount_to_buy" binding:"required,gt=0"`
		TxHash      string  `json:"tx_hash" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	buyerWalletRaw, _ := c.Get("walletAddress")
	buyerWallet := fmt.Sprintf("%v", buyerWalletRaw)

	// ── Phase 1: pre-flight validation (no network I/O, nothing is charged) ──
	var listing models.MarketplaceListing
	if err := config.DB.First(&listing, "id = ?", input.ListingID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Listing not found"})
		return
	}

	if strings.EqualFold(listing.SellerWallet, buyerWallet) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot buy your own listing"})
		return
	}

	if err := validateListingPurchasable(&listing); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if listing.CreditsTotal-listing.CreditsSold < input.AmountToBuy {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient credits available in listing"})
		return
	}

	// ── Phase 1b: server-side price computation ─────────────────────────────
	totalINR := input.AmountToBuy * listing.PricePerCredit
	fee := totalINR * 0.02
	sellerReceived := totalINR - fee

	platformWallet := os.Getenv("PLATFORM_WALLET")
	if platformWallet == "" {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "PLATFORM_WALLET is not configured; marketplace payments cannot be verified",
		})
		return
	}

	minWei, err := services.MinimumPaymentWei(totalINR)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Cannot determine the required payment amount: " + err.Error(),
		})
		return
	}

	// ── Phase 1c: verify the payment actually happened on-chain ──────────────
	if err := services.PaymentVerifier(input.TxHash, platformWallet, buyerWallet, minWei); err != nil {
		if errors.Is(err, services.ErrRPCNotConfigured) {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "RPC_URL is not configured; marketplace payments cannot be verified",
			})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "Payment verification failed: " + err.Error()})
		return
	}

	// ── Phase 2: critical section ───────────────────────────────────────────
	tx := config.DB.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}

	// Lock the listing row and re-validate it: between the pre-flight check
	// and here another buyer may have taken the remaining credits, or the
	// listing may have been cancelled (a confirmed tree cut cancels listings).
	var locked models.MarketplaceListing
	if err := lockRow(tx).First(&locked, "id = ?", input.ListingID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "Listing not found"})
		return
	}

	if err := validateListingPurchasable(&locked); err != nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if locked.CreditsTotal-locked.CreditsSold < input.AmountToBuy {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient credits available in listing"})
		return
	}

	// Reject a replayed transaction hash. The unique index on
	// marketplace_transactions.tx_hash is the race-free guard: the row is
	// inserted first and the unique violation is translated into 409. A
	// pre-insert COUNT cannot close the race between two concurrent requests
	// carrying the same hash.
	transaction := models.MarketplaceTransaction{
		ID:                uuid.New(),
		ListingID:         locked.ID,
		BuyerWallet:       buyerWallet,
		SellerWallet:      locked.SellerWallet,
		TreeID:            locked.TreeID,
		CreditsAmount:     input.AmountToBuy,
		PricePerCreditINR: locked.PricePerCredit,
		TotalINR:          totalINR,
		PlatformFeeINR:    fee,
		SellerReceivedINR: sellerReceived,
		EthAmount:         minWeiFloat(minWei),
		EthRateAtTime:     0,
		TxHash:            input.TxHash,
		Status:            "CONFIRMED",
		CreatedAt:         time.Now(),
	}

	if err := tx.Create(&transaction).Error; err != nil {
		tx.Rollback()
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "This transaction hash has already been used"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record transaction"})
		return
	}

	// Update listing
	newSold := locked.CreditsSold + input.AmountToBuy
	listingStatus := "PARTIAL"
	if newSold >= locked.CreditsTotal {
		listingStatus = "SOLD"
	}

	if err := tx.Model(&locked).Updates(map[string]interface{}{
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
	if err := tx.First(&tree, "tree_id = ?", locked.TreeID).Error; err == nil {
		tx.Model(&tree).Updates(map[string]interface{}{
			"credits_listed": tree.CreditsListed - input.AmountToBuy,
			"credits_sold":   tree.CreditsSold + input.AmountToBuy,
		})
	}

	tx.Commit()

	// Update Ledgers
	RecordCreditEvent(transaction.BuyerWallet, locked.TreeID, "BOUGHT", input.AmountToBuy, 0, transaction.ID.String()) // BalanceAfter omitted for brevity or calculated elsewhere
	RecordCreditEvent(locked.SellerWallet, locked.TreeID, "SOLD", input.AmountToBuy, 0, transaction.ID.String())

	LogActivity("CREDIT_SOLD", locked.TreeID, nil, locked.SellerWallet, fmt.Sprintf("Sold %.3f credits for ₹%.2f", input.AmountToBuy, totalINR))
	LogActivity("CREDIT_BOUGHT", locked.TreeID, nil, transaction.BuyerWallet, fmt.Sprintf("Bought %.3f credits for ₹%.2f", input.AmountToBuy, totalINR))

	c.JSON(http.StatusOK, transaction)
}

// minWeiFloat renders a wei amount as an ETH float for the denormalised
// EthAmount column. The authoritative value is the on-chain transaction; this
// column is informational only.
func minWeiFloat(wei *big.Int) float64 {
	if wei == nil || wei.Sign() <= 0 {
		return 0
	}
	f := new(big.Float).SetInt(wei)
	f.Quo(f, big.NewFloat(1e18))
	out, _ := f.Float64()
	return out
}

// GetMarketplacePaymentConfig — GET /api/marketplace/payment-config
//
// Publishes the parameters a client needs to construct a valid payment: the
// platform wallet that must receive the funds and the server-side ETH/INR
// rate the backend will verify against.
//
// The client must use this rate rather than its own price feed, otherwise a
// mismatch between the two makes legitimate purchases fail the on-chain
// "underpaid" check.
func GetMarketplacePaymentConfig(c *gin.Context) {
	rate, err := services.ETHInrRate()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":           "Marketplace pricing is not configured: " + err.Error(),
			"platform_wallet": os.Getenv("PLATFORM_WALLET"),
			"configured":      false,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"platform_wallet":      os.Getenv("PLATFORM_WALLET"),
		"eth_inr_rate":         rate,
		"platform_fee_percent": 2,
		"configured":           true,
	})
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
		Select("COALESCE(AVG(price_per_credit), 0)").Scan(&stats.AvgPrice)

	yesterday := time.Now().AddDate(0, 0, -1)
	config.DB.Model(&models.MarketplaceTransaction{}).
		Where("created_at >= ?", yesterday).
		Select("COALESCE(SUM(credits_amount), 0)").Scan(&stats.Volume24h)

	config.DB.Model(&models.MarketplaceTransaction{}).
		Select("COALESCE(SUM(total_inr), 0)").Scan(&stats.TotalTraded)

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
