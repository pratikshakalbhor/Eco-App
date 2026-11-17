package controllers

import (
	"bytes"
	"crypto/ecdsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"ecochain-backend/models"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ─────────────────────────────────────────────────
// Wallet nonce → signature → JWT flow
// ─────────────────────────────────────────────────

func newSigner(t *testing.T) (*ecdsa.PrivateKey, string) {
	t.Helper()
	key, err := crypto.GenerateKey()
	if err != nil {
		t.Fatal("failed to generate key:", err)
	}
	return key, strings.ToLower(crypto.PubkeyToAddress(key.PublicKey).Hex())
}

func signNonce(t *testing.T, key *ecdsa.PrivateKey, nonce string) string {
	t.Helper()
	hash := accounts.TextHash([]byte("EcoChain Auth Nonce: " + nonce))
	sig, err := crypto.Sign(hash, key)
	if err != nil {
		t.Fatal("failed to sign nonce:", err)
	}
	return hexutil.Encode(sig)
}

func authRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/auth/verify", VerifySignature)
	return r
}

func postVerify(t *testing.T, r *gin.Engine, address, signature string) *httptest.ResponseRecorder {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"address": address, "signature": signature})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/auth/verify", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	return w
}

func createUserWithNonce(t *testing.T, db *gorm.DB, wallet, nonce string) models.User {
	t.Helper()
	user := models.User{
		ID:            uuid.New(),
		WalletAddress: wallet,
		Role:          "user",
		Nonce:         nonce,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal("failed to create user:", err)
	}
	return user
}

func TestVerifySignature_ValidSignatureIssuesJWTAndClearsNonce(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	key, addr := newSigner(t)
	user := createUserWithNonce(t, db, addr, "nonce-one")

	w := postVerify(t, authRouter(), addr, signNonce(t, key, user.Nonce))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for a valid signature, got %d: %s", w.Code, w.Body.String())
	}
	var response struct {
		Token string      `json:"token"`
		User  models.User `json:"user"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal("failed to decode response:", err)
	}
	if response.Token == "" {
		t.Error("expected a JWT to be issued")
	}
	if response.User.ID != user.ID {
		t.Errorf("expected user %s, got %s", user.ID, response.User.ID)
	}

	var reloaded models.User
	db.First(&reloaded, "id = ?", user.ID)
	if reloaded.Nonce != "" {
		t.Errorf("expected the nonce to be cleared after use, got %q", reloaded.Nonce)
	}
}

func TestVerifySignature_ReplayedNonceIsRejected(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	key, addr := newSigner(t)
	user := createUserWithNonce(t, db, addr, "nonce-replay")
	signature := signNonce(t, key, user.Nonce)
	r := authRouter()

	first := postVerify(t, r, addr, signature)
	if first.Code != http.StatusOK {
		t.Fatalf("expected the first login to succeed, got %d: %s", first.Code, first.Body.String())
	}

	second := postVerify(t, r, addr, signature)
	if second.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for a reused nonce, got %d: %s", second.Code, second.Body.String())
	}
	if !strings.Contains(second.Body.String(), "Nonce expired or missing") {
		t.Errorf("expected an explicit nonce error, got %s", second.Body.String())
	}
}

func TestVerifySignature_MissingNonceIsRejectedAsExpired(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	key, addr := newSigner(t)
	// No nonce was ever requested for this user (or it already expired/used).
	createUserWithNonce(t, db, addr, "")

	w := postVerify(t, authRouter(), addr, signNonce(t, key, "anything"))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for an empty nonce, got %d: %s", w.Code, w.Body.String())
	}
}

func TestVerifySignature_BadSignatureHexIsRejected(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	_, addr := newSigner(t)
	createUserWithNonce(t, db, addr, "nonce-bad-hex")

	w := postVerify(t, authRouter(), addr, "0xnot-hex")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for a malformed signature, got %d: %s", w.Code, w.Body.String())
	}
}

func TestVerifySignature_WrongSignatureLengthIsRejected(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	_, addr := newSigner(t)
	createUserWithNonce(t, db, addr, "nonce-short")

	w := postVerify(t, authRouter(), addr, "0x1234")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for a short signature, got %d: %s", w.Code, w.Body.String())
	}
}

func TestVerifySignature_SignedByAnotherWalletIsRejected(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	_, victimAddr := newSigner(t)
	attackerKey, _ := newSigner(t)
	user := createUserWithNonce(t, db, victimAddr, "nonce-attacker")

	// The attacker signs the victim's challenge with their own key.
	w := postVerify(t, authRouter(), victimAddr, signNonce(t, attackerKey, user.Nonce))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 when another wallet signs, got %d: %s", w.Code, w.Body.String())
	}
}

func TestVerifySignature_SignatureForDifferentMessageIsRejected(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)
	key, addr := newSigner(t)
	createUserWithNonce(t, db, addr, "nonce-real")

	w := postVerify(t, authRouter(), addr, signNonce(t, key, "nonce-other"))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for a signature over another message, got %d: %s", w.Code, w.Body.String())
	}
}
