package controllers

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"ecochain-backend/services"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetMyDebts — GET /api/debt
// Returns all replantation debts for the connected user's wallet.
func GetMyDebts(c *gin.Context) {
	walletAddressRaw, exists := c.Get("walletAddress")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Wallet address not found in context"})
		return
	}
	walletAddress := fmt.Sprintf("%v", walletAddressRaw)

	debts := make([]models.ReplantationDebt, 0)
	if err := config.DB.
		Preload("ReplacementTrees").
		Where("owner_wallet = ?", walletAddress).
		Order("created_at desc").
		Find(&debts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch debts"})
		return
	}

	type EnrichedDebt struct {
		models.ReplantationDebt
		Loss *models.EnvironmentalLoss `json:"environmental_loss"`
	}

	enriched := make([]EnrichedDebt, 0)
	for _, debt := range debts {
		var loss models.EnvironmentalLoss
		config.DB.Where("tree_id = ?", debt.OriginalTreeID).First(&loss)
		enriched = append(enriched, EnrichedDebt{
			ReplantationDebt: debt,
			Loss:             &loss,
		})
	}

	c.JSON(http.StatusOK, enriched)
}

// GetDebtByID — GET /api/debt/:id
// Returns a single debt with full replacement tree progress.
func GetDebtByID(c *gin.Context) {
	debtID := c.Param("id")

	var debt models.ReplantationDebt
	if err := config.DB.
		Preload("ReplacementTrees").
		First(&debt, "id = ?", debtID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Debt not found"})
		return
	}

	// Enrich with tree details for each replacement tree
	type EnrichedReplacement struct {
		models.ReplacementTree
		TreeInfo *models.Tree `json:"tree_info"`
	}

	enriched := make([]EnrichedReplacement, 0)
	for _, rt := range debt.ReplacementTrees {
		var tree models.Tree
		config.DB.Where("tree_id = ?", rt.TreeID).First(&tree)
		enriched = append(enriched, EnrichedReplacement{
			ReplacementTree: rt,
			TreeInfo:        &tree,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"debt":              debt,
		"replacement_trees": enriched,
	})
}

// LinkTreeToDebt — POST /api/debt/:id/link-tree
// Links a newly planted tree to a replantation debt.
// Updates debt progress and clears it if all trees are verified.
func LinkTreeToDebt(c *gin.Context) {
	debtID := c.Param("id")

	var input struct {
		TreeID string `json:"tree_id" binding:"required"`
		TxHash string `json:"tx_hash"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// With an RPC endpoint configured, a replantation link must be backed by
	// the on-chain markReplanted transaction. Without it the debt progress is
	// pure off-chain bookkeeping.
	if os.Getenv("RPC_URL") != "" && input.TxHash == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "tx_hash is required: the on-chain markReplanted transaction must be supplied",
		})
		return
	}

	var replanted *services.TreeReplantedEvent
	if input.TxHash != "" {
		decoded, err := services.ReplantationDecoder(input.TxHash)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Replantation transaction not confirmed: " + err.Error()})
			return
		}
		replanted = decoded
	}

	walletAddressRaw, exists := c.Get("walletAddress")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Wallet address not found in context"})
		return
	}
	walletAddress := fmt.Sprintf("%v", walletAddressRaw)

	// Validate debt
	var debt models.ReplantationDebt
	if err := config.DB.First(&debt, "id = ?", debtID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Debt not found"})
		return
	}

	// Only the owner of the debt may link replacement trees to it.
	if !strings.EqualFold(debt.OwnerWallet, walletAddress) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You are not authorized to modify this debt"})
		return
	}

	if debt.Status == "CLEARED" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This debt is already cleared"})
		return
	}

	// Validate the tree exists and belongs to the same owner
	var tree models.Tree
	if err := config.DB.First(&tree, "tree_id = ?", input.TreeID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tree not found"})
		return
	}

	// The tree must belong to the requesting user, i.e. the same owner as the debt.
	if !strings.EqualFold(tree.OwnerWallet, walletAddress) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You are not authorized to link this tree"})
		return
	}

	// When a transaction was supplied, the decoded event must name exactly
	// this replacement tree and this debt's original tree.
	if replanted != nil {
		var originalTree models.Tree
		if err := config.DB.First(&originalTree, "tree_id = ?", debt.OriginalTreeID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Original tree not found"})
			return
		}
		if err := services.ValidateReplantation(replanted, tree.BlockchainTokenID, originalTree.BlockchainTokenID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Replantation transaction does not match this debt: " + err.Error()})
			return
		}
	}

	// Check not already linked
	var existingLink models.ReplacementTree
	if config.DB.Where("debt_id = ? AND tree_id = ?", debtID, input.TreeID).First(&existingLink).Error == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tree is already linked to this debt"})
		return
	}

	tx := config.DB.Begin()

	// Create the link
	link := models.ReplacementTree{
		ID:              uuid.New(),
		DebtID:          debt.ID,
		TreeID:          input.TreeID,
		LinkedAt:        time.Now(),
		TransactionHash: input.TxHash,
	}

	if err := tx.Create(&link).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to link tree"})
		return
	}

	// Mark tree as replacement
	if err := tx.Model(&tree).Updates(map[string]interface{}{
		"is_replacement":    true,
		"replanted_debt_id": debt.ID,
	}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update tree"})
		return
	}

	// Update debt progress
	newPlanted := debt.TreesPlanted + 1
	newVerified := debt.TreesVerified
	if tree.Status == "VERIFIED" {
		newVerified++
	}

	newStatus := debt.Status
	if newPlanted > 0 && newPlanted < debt.TreesNeeded {
		newStatus = "IN_PROGRESS"
	}

	var clearedAt *time.Time
	if newVerified >= debt.TreesNeeded {
		newStatus = "CLEARED"
		now := time.Now()
		clearedAt = &now

		// Unfreeze carbon credits for original tree
		var origTree models.Tree
		if config.DB.First(&origTree, "tree_id = ?", debt.OriginalTreeID).Error == nil {
			tx.Model(&models.CarbonCredit{}).
				Where("tree_id = ?", origTree.ID).
				Update("tradeable", true)
		}
	}

	updates := map[string]interface{}{
		"trees_planted":  newPlanted,
		"trees_verified": newVerified,
		"status":         newStatus,
		"updated_at":     time.Now(),
	}
	if clearedAt != nil {
		updates["cleared_at"] = clearedAt
	}

	if err := tx.Model(&debt).Updates(updates).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update debt progress"})
		return
	}

	// Logging — written through the open transaction so the audit trail is
	// committed atomically with the change it describes.
	LogActivityTx(tx, "TREE_LINKED", tree.TreeID, &debt.ID, tree.OwnerWallet, fmt.Sprintf("Linked tree %s as replacement for debt", tree.TreeID))

	if newStatus == "CLEARED" {
		// Generate Certificate
		certID := fmt.Sprintf("CERT-%d-%s", time.Now().Unix(), uuid.New().String()[:4])

		var loss models.EnvironmentalLoss
		config.DB.Where("tree_id = ?", debt.OriginalTreeID).First(&loss)

		certificate := models.RestorationCertificate{
			ID:              uuid.New(),
			CertificateID:   certID,
			DebtID:          debt.ID,
			IssuedTo:        debt.OwnerWallet,
			OriginalTreeID:  debt.OriginalTreeID,
			CO2RestoredKg:   loss.CO2LostKg,
			CreditsRestored: loss.CreditsLost,
			IssuedAt:        time.Now(),
		}

		if err := tx.Create(&certificate).Error; err == nil {
			tx.Model(&debt).Update("certificate_id", certID)
			LogActivityTx(tx, "DEBT_CLEARED", debt.OriginalTreeID, &debt.ID, debt.OwnerWallet, "Environmental debt fully cleared and restoration certificate issued")
		}
	}

	tx.Commit()

	message := fmt.Sprintf("Tree %s linked to debt. Progress: %d/%d planted", input.TreeID, newPlanted, debt.TreesNeeded)
	if newStatus == "CLEARED" {
		message = fmt.Sprintf("🎉 Environmental debt cleared! All %d replacement trees verified. Credits restored.", debt.TreesNeeded)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  message,
		"debt_id":  debtID,
		"status":   newStatus,
		"progress": gin.H{"planted": newPlanted, "verified": newVerified, "needed": debt.TreesNeeded},
	})
}

// GetAllDebts — GET /api/debt/all
// Public transparency view backing the Environment "Trees Needing Replantation"
// panel. Returns restoration progress only — NO owner wallets, NO original or
// replacement tree identifiers. (The previous comment claimed "admin only", but
// the non-admin Environment page is the sole consumer, so this is a deliberately
// non-identifying public aggregate rather than an admin-only listing.)
func GetAllDebts(c *gin.Context) {
	debts := make([]models.ReplantationDebt, 0)

	if err := config.DB.
		Order("created_at desc").
		Find(&debts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch debts"})
		return
	}

	// Non-identifying projection. OwnerWallet / OriginalTreeID are kept as
	// empty strings so existing consumers (which read those keys) keep working
	// without crashing, while no private data is transmitted.
	type PublicDebt struct {
		ID            uuid.UUID  `json:"id"`
		Status        string     `json:"status"`
		TreesNeeded   int        `json:"trees_needed"`
		TreesPlanted  int        `json:"trees_planted"`
		TreesVerified int        `json:"trees_verified"`
		CreatedAt     time.Time  `json:"created_at"`
		ClearedAt     *time.Time `json:"cleared_at"`
		// Redacted placeholders for backward compatibility — always empty.
		OwnerWallet    string `json:"owner_wallet"`
		OriginalTreeID string `json:"original_tree_id"`
	}

	public := make([]PublicDebt, 0, len(debts))
	for _, d := range debts {
		public = append(public, PublicDebt{
			ID:             d.ID,
			Status:         d.Status,
			TreesNeeded:    d.TreesNeeded,
			TreesPlanted:   d.TreesPlanted,
			TreesVerified:  d.TreesVerified,
			CreatedAt:      d.CreatedAt,
			ClearedAt:      d.ClearedAt,
			OwnerWallet:    "",
			OriginalTreeID: "",
		})
	}

	c.JSON(http.StatusOK, public)
}

// GetCertificateData — GET /api/debt/:id/certificate
func GetCertificateData(c *gin.Context) {
	debtID := c.Param("id")

	var debt models.ReplantationDebt
	if err := config.DB.First(&debt, "id = ?", debtID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Debt not found"})
		return
	}

	var cert models.RestorationCertificate
	if err := config.DB.Where("debt_id = ?", debt.ID).First(&cert).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Certificate not found"})
		return
	}

	// Fetch replacement tree IDs
	var replacementTrees []models.ReplacementTree
	config.DB.Where("debt_id = ?", debt.ID).Find(&replacementTrees)
	treeIDs := make([]string, len(replacementTrees))
	for i, rt := range replacementTrees {
		treeIDs[i] = rt.TreeID
	}

	var origTree models.Tree
	config.DB.Where("tree_id = ?", debt.OriginalTreeID).First(&origTree)

	c.JSON(http.StatusOK, gin.H{
		"certificate_id": cert.CertificateID,
		"issued_to":      cert.IssuedTo,
		"original_tree": gin.H{
			"id":       origTree.TreeID,
			"species":  origTree.Species,
			"location": origTree.Location,
		},
		"cut_date":          debt.CreatedAt, // Approximate
		"cleared_date":      debt.ClearedAt,
		"replacement_trees": treeIDs,
		"co2_restored_kg":   cert.CO2RestoredKg,
		"credits_restored":  cert.CreditsRestored,
		"issued_at":         cert.IssuedAt,
	})
}
