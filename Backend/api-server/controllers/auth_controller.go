package controllers

import (
	"crypto/rand"
	"ecochain-backend/config"
	"ecochain-backend/models"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
)

// GetNonce returns a new nonce for a given wallet address
func GetNonce(c *gin.Context) {
	walletAddress := c.Query("address")
	if walletAddress == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Wallet address required"})
		return
	}

	nonce := make([]byte, 16)
	rand.Read(nonce)
	nonceStr := hex.EncodeToString(nonce)

	var user models.User
	result := config.DB.Where("wallet_address = ?", walletAddress).First(&user)

	if result.Error != nil {
		// Create new user if not exists
		user = models.User{
			ID:            uuid.New(),
			WalletAddress: walletAddress,
			Nonce:         nonceStr,
			Role:          "user",
		}
		config.DB.Create(&user)
	} else {
		// Update nonce for existing user
		user.Nonce = nonceStr
		config.DB.Save(&user)
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

	var user models.User
	if err := config.DB.Where("wallet_address = ?", input.WalletAddress).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// 1. Reconstruct the message that was signed
	msg := fmt.Sprintf("EcoChain Auth Nonce: %s", user.Nonce)
	isValid := verifySig(input.WalletAddress, input.Signature, []byte(msg))

	if !isValid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
		return
	}

	// 2. Clear nonce after successful login
	user.Nonce = ""
	config.DB.Save(&user)

	// 3. Generate JWT
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID.String(),
		"role":    user.Role,
		"exp":     time.Now().Add(time.Hour * 72).Unix(),
	})

	tokenString, _ := token.SignedString([]byte(os.Getenv("JWT_SECRET")))

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

// verifySig checks if a signature is valid for a given message and address
func verifySig(from string, sigHex string, msg []byte) bool {
	sig, err := hexutil.Decode(sigHex)
	if err != nil {
		return false
	}

	// Handle Ethereum's "V" value (27 or 28 -> 0 or 1)
	if sig[64] != 27 && sig[64] != 28 {
		return false
	}
	sig[64] -= 27

	// Add the Ethereum prefix
	fullMsg := fmt.Sprintf("\x19Ethereum Signed Message:\n%d%s", len(msg), msg)
	hash := crypto.Keccak256([]byte(fullMsg))

	pubKey, err := crypto.SigToPub(hash, sig)
	if err != nil {
		return false
	}

	recoveredAddr := crypto.PubkeyToAddress(*pubKey)
	return recoveredAddr.Hex() == from
}
