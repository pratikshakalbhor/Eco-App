package controllers

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"ecochain-backend/services"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AbsorptionRates Species-based carbon absorption coefficients (kg/year)
var AbsorptionRates = map[string]float64{
	"oak":        21.0,
	"pine":       18.0,
	"maple":      24.0,
	"birch":      19.0,
	"willow":     16.0,
	"cedar":      22.0,
	"spruce":     20.0,
	"bamboo":     35.0,
	"neem":       22.0,
	"mango":      30.0,
	"peepal":     28.0,
	"banyan":     32.0,
	"teak":       25.0,
	"eucalyptus": 26.0,
	"gulmohar":   20.0,
	"jamun":      23.0,
}

func GetUserCarbonCredits(c *gin.Context) {
	userIDString, _ := c.Get("userID")
	userID, _ := uuid.Parse(userIDString.(string))

	var credits []models.CarbonCredit
	if err := config.DB.Where("user_id = ?", userID).Order("created_at desc").Find(&credits).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch credits"})
		return
	}

	var trees []models.Tree
	if err := config.DB.Where("planter_id = ?", userID).Find(&trees).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch trees"})
		return
	}

	var totalBalance, creditsEarned, creditsLost float64
	var activeTrees, cutTrees, replacementTrees int
	var totalCO2Absorption, totalOxygenGen float64

	for _, credit := range credits {
		totalBalance += credit.Amount
		if credit.Amount > 0 {
			creditsEarned += credit.Amount
		} else {
			creditsLost += MathAbs(credit.Amount)
		}
	}

	for _, tree := range trees {
		switch tree.Status {
		case "VERIFIED":
			activeTrees++
			years := time.Since(tree.PlantedAt).Hours() / 24 / 365
			totalCO2Absorption += tree.CarbonAbsorptionRate * years
			// The oxygen mass ratio (0.727 kg O2 per kg CO2) comes from the
			// shared accounting model so this figure can never disagree with
			// the environmental loss calculation.
			totalOxygenGen += tree.CarbonAbsorptionRate * years * services.OxygenToCarbonMassRatio
		case "CUT_CONFIRMED":
			cutTrees++
		}
		if tree.IsReplacement {
			replacementTrees++
		}
	}

	// Environmental debt: replantation debts still open
	var envDebt float64
	var envDebtActive bool
	walletRaw, _ := c.Get("walletAddress")
	walletStr := fmt.Sprintf("%v", walletRaw)
	var openDebts int64
	config.DB.Model(&models.ReplantationDebt{}).
		Where("owner_wallet = ? AND status != ?", walletStr, "CLEARED").
		Count(&openDebts)
	config.DB.Model(&models.EnvironmentalLoss{}).
		Joins("JOIN cut_reports cr ON environmental_losses.tree_id = cr.tree_id").
		Joins("JOIN trees t ON t.tree_id = cr.tree_id AND t.owner_wallet = ?", walletStr).
		Select("COALESCE(SUM(co2_lost_kg), 0)").Scan(&envDebt)
	envDebtActive = openDebts > 0

	// Sustainability score: starts at 100, penalized by environmental debt.
	// creditsEarned/creditsLost are in credits and envDebt is in kg, so the kg
	// figure is converted to credits first — adding the raw units made the
	// penalty 1000x larger than intended.
	sustainabilityScore := 100.0
	if creditsEarned > 0 {
		debtCredits := services.KgToCredits(envDebt)
		sustainabilityScore = (creditsEarned / (creditsEarned + creditsLost + debtCredits + 0.01)) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"carbon_balance":        totalBalance,
		"credits_earned":        creditsEarned,
		"credits_lost":          creditsLost,
		"environmental_debt":    envDebt,
		"compensation_required": envDebtActive,
		"active_trees":          activeTrees,
		"cut_trees":             cutTrees,
		"replacement_trees":     replacementTrees,
		"co2_stats": gin.H{
			"total_absorbed": totalCO2Absorption,
			"avg_rate":       totalCO2Absorption / (float64(activeTrees) + 0.1),
		},
		"oxygen_stats": gin.H{
			"total_generated": totalOxygenGen,
		},
		"sustainability_score": sustainabilityScore,
		"history":              credits,
	})
}

// BurnCarbonCredits — POST /api/credits/burn
// Retires carbon credits by recording a negative ledger entry.
//
// When RPC_URL is configured the caller's tx_hash must be a successful
// EcoToken burn of exactly the requested amount, performed by the
// authenticated wallet. Without that check the tx hash would be decorative and
// a user could retire ledger credits while keeping (and reselling) the tokens.
//
// The burn is idempotent on the transaction hash: replaying the same hash is
// rejected with 409 rather than burning the credits a second time.
func BurnCarbonCredits(c *gin.Context) {
	walletRaw, _ := c.Get("walletAddress")
	wallet := fmt.Sprintf("%v", walletRaw)
	userIDString, _ := c.Get("userID")
	userID, _ := uuid.Parse(userIDString.(string))

	var req struct {
		Amount float64 `json:"amount" binding:"required,gt=0"`
		// The transaction hash is required: it identifies the retirement
		// transaction and is what makes the burn idempotent.
		TxHash  string `json:"tx_hash" binding:"required"`
		Purpose string `json:"purpose"` // e.g. "Carbon Offset for XYZ project"
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// The balance is derived from the FULL signed ledger: issuance rows are
	// positive and burn rows are negative, so SUM(amount) is already net of
	// everything that has been burned.
	//
	// The previous implementation summed only the positive rows, so the
	// balance never decreased when credits were burned and the same credits
	// could be burned over and over.
	var ledgerNet float64
	config.DB.Model(&models.CarbonCredit{}).
		Where("user_id = ?", userID).
		Select("COALESCE(SUM(amount), 0)").Scan(&ledgerNet)

	// Credits frozen by an unresolved replantation debt are not spendable.
	var frozenEarned float64
	config.DB.Model(&models.CarbonCredit{}).
		Where("user_id = ? AND amount > 0 AND tradeable = ?", userID, false).
		Select("COALESCE(SUM(amount), 0)").Scan(&frozenEarned)

	var sold float64
	config.DB.Model(&models.MarketplaceTransaction{}).
		Where("seller_wallet = ? AND status = ?", wallet, "CONFIRMED").
		Select("COALESCE(SUM(credits_amount), 0)").Scan(&sold)

	var listed float64
	config.DB.Model(&models.MarketplaceListing{}).
		Where("seller_wallet = ? AND status IN ?", wallet, []string{"ACTIVE", "PARTIAL"}).
		Select("COALESCE(SUM(credits_total - credits_sold), 0)").Scan(&listed)

	balance := ledgerNet - frozenEarned - sold - listed
	if balance < req.Amount {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Insufficient credits. Available: %.4f, Requested: %.4f", balance, req.Amount)})
		return
	}

	// Verify the retirement on-chain before touching the ledger. In local/dev
	// setups without an RPC endpoint the hash is recorded as-is; production
	// (RPC_URL set) must prove it.
	if os.Getenv("RPC_URL") != "" {
		burn, err := services.CreditBurnDecoder(req.TxHash)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Burn transaction not confirmed: " + err.Error()})
			return
		}
		if err := services.ValidateCreditBurn(burn, wallet, req.Amount); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Burn transaction does not match this wallet and amount: " + err.Error()})
			return
		}
	}

	// Record burn as negative credit entry
	burnRecord := models.CarbonCredit{
		ID:              uuid.New(),
		UserID:          userID,
		Amount:          -req.Amount, // Negative = burned
		TransactionHash: req.TxHash,
		Type:            "burned",
		Tradeable:       false,
	}
	if err := config.DB.Create(&burnRecord).Error; err != nil {
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "This transaction has already been recorded as a burn"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record burn"})
		return
	}

	// Record in ledger
	purpose := req.Purpose
	if purpose == "" {
		purpose = "Carbon Offset"
	}
	RecordCreditEvent(wallet, "", "BURNED", -req.Amount, balance-req.Amount, purpose)

	// Log activity
	LogActivity("CREDITS_BURNED", "", nil, wallet,
		fmt.Sprintf("%.4f carbon credits burned for %s (Tx: %s)", req.Amount, purpose, req.TxHash))

	c.JSON(http.StatusOK, gin.H{
		"message":           "Carbon credits burned successfully",
		"amount_burned":     req.Amount,
		"remaining_balance": balance - req.Amount,
		"tx_hash":           req.TxHash,
		"purpose":           purpose,
		"co2_offset_tonnes": req.Amount,
	})
}

func MathAbs(v float64) float64 {
	if v < 0 {
		return -v
	}
	return v
}

func MintCreditsForTree(treeID uuid.UUID, amount float64, txHash string) error {
	var tree models.Tree
	if err := config.DB.First(&tree, "id = ?", treeID).Error; err != nil {
		return err
	}

	credit := models.CarbonCredit{
		ID:              uuid.New(),
		UserID:          tree.PlanterID,
		TreeID:          tree.ID,
		Amount:          amount,
		TransactionHash: txHash,
		Type:            "minted",
		Tradeable:       true,
	}

	return config.DB.Create(&credit).Error
}
