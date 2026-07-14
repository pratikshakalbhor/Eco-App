package controllers

import (
	"crypto/rand"
	"ecochain-backend/config"
	"ecochain-backend/models"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// GetNonce returns a new nonce for a given wallet address
func GetNonce(c *gin.Context) {
	// Normalise address to lowercase for consistent DB storage
	walletAddress := strings.ToLower(c.Query("address"))
	if walletAddress == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Wallet address required"})
		return
	}

	nonce := make([]byte, 16)
	rand.Read(nonce)
	nonceStr := hex.EncodeToString(nonce)

	log.Printf("[GetNonce] address=%s  nonce=%s", walletAddress, nonceStr)

	var user models.User
	result := config.DB.Where("wallet_address = ?", walletAddress).First(&user)

	if result.Error != nil {
		// Create new user
		user = models.User{
			ID:            uuid.New(),
			WalletAddress: walletAddress,
			Nonce:         nonceStr,
			Role:          "user",
		}
		if err := config.DB.Create(&user).Error; err != nil {
			log.Printf("[GetNonce] ERROR creating user: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
			return
		}
		log.Printf("[GetNonce] New user created id=%s", user.ID)
	} else {
		// Update nonce only — avoid overwriting other fields
		if err := config.DB.Model(&user).Update("nonce", nonceStr).Error; err != nil {
			log.Printf("[GetNonce] ERROR updating nonce: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update nonce"})
			return
		}
		log.Printf("[GetNonce] Nonce updated for existing user id=%s", user.ID)
	}

	c.JSON(http.StatusOK, gin.H{"nonce": nonceStr})
}

// VerifySignature checks the signed nonce and returns a JWT
func VerifySignature(c *gin.Context) {
	var input struct {
		WalletAddress string `json:"address" binding:"required"`
		Signature     string `json:"signature" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Normalise address to lowercase to match stored value
	input.WalletAddress = strings.ToLower(input.WalletAddress)

	log.Printf("[VerifySignature] address=%s  sig=%s", input.WalletAddress, input.Signature)

	var user models.User
	if err := config.DB.Where("wallet_address = ?", input.WalletAddress).First(&user).Error; err != nil {
		log.Printf("[VerifySignature] User not found for address=%s", input.WalletAddress)
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	log.Printf("[VerifySignature] Found user id=%s  stored_nonce=%s", user.ID, user.Nonce)

	if user.Nonce == "" {
		log.Printf("[VerifySignature] ERROR: nonce is empty for user %s", user.ID)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nonce expired or missing. Please request a new nonce."})
		return
	}

	// The message the frontend signs — must match EXACTLY what useAuth.jsx builds
	msg := fmt.Sprintf("EcoChain Auth Nonce: %s", user.Nonce)
	log.Printf("[VerifySignature] message_to_verify=%q", msg)

	recoveredAddr, err := recoverAddress(input.Signature, msg)
	if err != nil {
		log.Printf("[VerifySignature] recoverAddress error: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Signature recovery failed"})
		return
	}

	log.Printf("[VerifySignature] recovered=%s  expected=%s", recoveredAddr, input.WalletAddress)

	if recoveredAddr != input.WalletAddress {
		log.Printf("[VerifySignature] Address mismatch — invalid signature")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
		return
	}

	log.Printf("[VerifySignature] Signature VALID — issuing JWT")

	// Clear nonce after successful login (replay protection)
	config.DB.Model(&user).Update("nonce", "")

	// Generate JWT
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":        user.ID.String(),
		"wallet_address": user.WalletAddress,
		"role":           user.Role,
		"exp":            time.Now().Add(time.Hour * 72).Unix(),
	})

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Printf("[VerifySignature] WARNING: JWT_SECRET is empty!")
	}

	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		log.Printf("[VerifySignature] JWT signing error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"user":  user,
	})
}

func GetMe(c *gin.Context) {
	userID, _ := c.Get("userID")
	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func GetUserStats(c *gin.Context) {
	userIDString, _ := c.Get("userID")
	userID, _ := uuid.Parse(userIDString.(string))

	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var totalTrees int64
	config.DB.Model(&models.Tree{}).Where("planter_id = ?", userID).Count(&totalTrees)

	var verifiedTrees int64
	config.DB.Model(&models.Tree{}).Where("planter_id = ? AND status = ?", userID, "VERIFIED").Count(&verifiedTrees)

	var cutTrees int64
	config.DB.Model(&models.Tree{}).Where("planter_id = ? AND (status = ? OR status = ?)", userID, "CUT_REPORTED", "CUT_CONFIRMED").Count(&cutTrees)

	var replacementTrees int64
	var totalDebtTrees int64
	var debts []models.ReplantationDebt
	config.DB.Where("owner_wallet = ?", user.WalletAddress).Find(&debts)

	for _, d := range debts {
		replacementTrees += int64(d.TreesVerified)
		if d.Status != "CLEARED" {
			totalDebtTrees += int64(d.TreesNeeded - d.TreesVerified)
		}
	}

	var totalCredits float64
	config.DB.Model(&models.CarbonCredit{}).Where("user_id = ?", userID).Select("COALESCE(SUM(amount), 0)").Scan(&totalCredits)

	c.JSON(http.StatusOK, gin.H{
		"total_trees":           totalTrees,
		"verified_trees":        verifiedTrees,
		"cut_trees":             cutTrees,
		"replacement_trees":     replacementTrees,
		"environmental_debt":    float64(totalDebtTrees), // returning count as debt for now
		"compensation_required": totalDebtTrees > 0,
		"carbon_credits":        totalCredits,
		"nfts_minted":           verifiedTrees,
		"xp_points":             user.XPPoints,
		"level":                 user.Level,
	})
}

func UpdateUserRole(c *gin.Context) {
	targetUserID := c.Param("id")
	var input struct {
		Role string `json:"role" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate allowed roles
	allowedRoles := map[string]bool{"user": true, "verifier": true, "admin": true}
	if !allowedRoles[input.Role] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
		return
	}

	if err := config.DB.Model(&models.User{}).Where("id = ?", targetUserID).Update("role", input.Role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user role"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Role updated successfully", "new_role": input.Role})
}

// recoverAddress recovers the signer address from an EIP-191 personal_sign signature.
func recoverAddress(sigHex string, message string) (string, error) {
	sig, err := hexutil.Decode(sigHex)
	if err != nil {
		return "", fmt.Errorf("invalid hex signature: %w", err)
	}
	if len(sig) != 65 {
		return "", fmt.Errorf("invalid signature length: got %d, want 65", len(sig))
	}

	// Normalise recovery ID: MetaMask uses 27/28, go-ethereum needs 0/1
	if sig[64] >= 27 {
		sig[64] -= 27
	}

	// accounts.TextHash applies the EIP-191 prefix — mirrors ethers.js hashMessage()
	hash := accounts.TextHash([]byte(message))

	pubKey, err := crypto.SigToPub(hash, sig)
	if err != nil {
		return "", fmt.Errorf("SigToPub failed: %w", err)
	}

	recovered := crypto.PubkeyToAddress(*pubKey)
	// Return lowercase to match our stored/compared format
	return strings.ToLower(common.HexToAddress(recovered.Hex()).Hex()), nil
}
