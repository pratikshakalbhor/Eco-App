package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const testJWTSecret = "test-secret-key-for-unit-tests"

func setupTestEnv(t *testing.T) {
	t.Helper()
	os.Setenv("JWT_SECRET", testJWTSecret)
	gin.SetMode(gin.TestMode)
}

func generateTestToken(userID, walletAddress, role string, exp time.Time) string {
	claims := jwt.MapClaims{
		"user_id":        userID,
		"wallet_address": walletAddress,
		"role":           role,
		"exp":            exp.Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, _ := token.SignedString([]byte(testJWTSecret))
	return tokenString
}

func performRequest(r *gin.Engine, method, path, authHeader string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(method, path, nil)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	r.ServeHTTP(w, req)
	return w
}

// ─────────────────────────────────────────────────
// AuthMiddleware Tests
// ─────────────────────────────────────────────────

func TestAuthMiddleware_NoHeader(t *testing.T) {
	setupTestEnv(t)
	r := gin.New()
	r.Use(AuthMiddleware())
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := performRequest(r, "GET", "/test", "")
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthMiddleware_InvalidFormat(t *testing.T) {
	setupTestEnv(t)
	r := gin.New()
	r.Use(AuthMiddleware())
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := performRequest(r, "GET", "/test", "InvalidToken")
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for invalid format, got %d", w.Code)
	}
}

func TestAuthMiddleware_WrongPrefix(t *testing.T) {
	setupTestEnv(t)
	r := gin.New()
	r.Use(AuthMiddleware())
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := performRequest(r, "GET", "/test", "Basic sometoken")
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for wrong prefix, got %d", w.Code)
	}
}

func TestAuthMiddleware_ExpiredToken(t *testing.T) {
	setupTestEnv(t)
	r := gin.New()
	r.Use(AuthMiddleware())
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	expiredToken := generateTestToken("user-1", "0xabc", "user", time.Now().Add(-1*time.Hour))
	w := performRequest(r, "GET", "/test", "Bearer "+expiredToken)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for expired token, got %d", w.Code)
	}
}

func TestAuthMiddleware_InvalidSignature(t *testing.T) {
	os.Setenv("JWT_SECRET", testJWTSecret)
	r := gin.New()
	r.Use(AuthMiddleware())
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	// Token signed with a different secret
	claims := jwt.MapClaims{
		"user_id":        "user-1",
		"wallet_address": "0xabc",
		"role":           "user",
		"exp":            time.Now().Add(1 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	badToken, _ := token.SignedString([]byte("wrong-secret"))

	w := performRequest(r, "GET", "/test", "Bearer "+badToken)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for bad signature, got %d", w.Code)
	}
}

func TestAuthMiddleware_ValidToken(t *testing.T) {
	setupTestEnv(t)
	r := gin.New()
	r.Use(AuthMiddleware())
	r.GET("/test", func(c *gin.Context) {
		userID, _ := c.Get("userID")
		wallet, _ := c.Get("walletAddress")
		role, _ := c.Get("role")
		c.JSON(http.StatusOK, gin.H{
			"user_id": userID,
			"wallet":  wallet,
			"role":    role,
		})
	})

	validToken := generateTestToken("user-123", "0xabcdef", "verifier", time.Now().Add(24*time.Hour))
	w := performRequest(r, "GET", "/test", "Bearer "+validToken)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	body := w.Body.String()
	if !contains(body, "user-123") {
		t.Error("expected userID in response")
	}
	if !contains(body, "0xabcdef") {
		t.Error("expected wallet address in response")
	}
	if !contains(body, "verifier") {
		t.Error("expected role in response")
	}
}

func TestAuthMiddleware_EmptyBearerToken(t *testing.T) {
	setupTestEnv(t)
	r := gin.New()
	r.Use(AuthMiddleware())
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := performRequest(r, "GET", "/test", "Bearer ")
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for empty bearer token, got %d", w.Code)
	}
}

// ─────────────────────────────────────────────────
// RoleMiddleware Tests
// ─────────────────────────────────────────────────

func performRequestWithContext(r *gin.Engine, method, path string, contextSetup func(c *gin.Context)) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(method, path, nil)
	r.ServeHTTP(w, req)
	return w
}

func TestRoleMiddleware_NoRoleInContext(t *testing.T) {
	setupTestEnv(t)
	r := gin.New()
	r.Use(RoleMiddleware("admin"))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := performRequest(r, "GET", "/test", "")
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 when no role in context, got %d", w.Code)
	}
}

func TestRoleMiddleware_AllowedRole(t *testing.T) {
	setupTestEnv(t)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("role", "admin")
		c.Next()
	})
	r.Use(RoleMiddleware("admin", "verifier"))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := performRequest(r, "GET", "/test", "")
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for allowed role, got %d", w.Code)
	}
}

func TestRoleMiddleware_DeniedRole(t *testing.T) {
	setupTestEnv(t)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("role", "user")
		c.Next()
	})
	r.Use(RoleMiddleware("admin", "verifier"))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := performRequest(r, "GET", "/test", "")
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for denied role, got %d", w.Code)
	}

	body := w.Body.String()
	if !contains(body, "insufficient permissions") {
		t.Error("expected 'insufficient permissions' in error response")
	}
}

func TestRoleMiddleware_NonStringRole(t *testing.T) {
	setupTestEnv(t)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("role", 12345) // non-string
		c.Next()
	})
	r.Use(RoleMiddleware("admin"))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := performRequest(r, "GET", "/test", "")
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for non-string role, got %d", w.Code)
	}
}

func TestRoleMiddleware_SingleAllowedRole(t *testing.T) {
	setupTestEnv(t)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("role", "admin")
		c.Next()
	})
	r.Use(RoleMiddleware("admin"))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := performRequest(r, "GET", "/test", "")
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// ─────────────────────────────────────────────────
// Integration: Auth + Role chained middleware
// ─────────────────────────────────────────────────

func TestMiddlewareChain_AuthThenRole(t *testing.T) {
	setupTestEnv(t)
	r := gin.New()
	r.Use(AuthMiddleware())
	r.Use(RoleMiddleware("admin"))
	r.GET("/admin/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	// Non-admin token
	token := generateTestToken("user-1", "0xabc", "user", time.Now().Add(1*time.Hour))
	w := performRequest(r, "GET", "/admin/test", "Bearer "+token)
	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for non-admin, got %d", w.Code)
	}

	// Admin token
	adminToken := generateTestToken("admin-1", "0xadmin", "admin", time.Now().Add(1*time.Hour))
	w = performRequest(r, "GET", "/admin/test", "Bearer "+adminToken)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for admin, got %d", w.Code)
	}
}

func TestMiddlewareChain_NoAuthThenRole(t *testing.T) {
	setupTestEnv(t)
	r := gin.New()
	r.Use(AuthMiddleware())
	r.Use(RoleMiddleware("admin"))
	r.GET("/admin/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := performRequest(r, "GET", "/admin/test", "")
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 without auth, got %d", w.Code)
	}
}

// ─────────────────────────────────────────────────
// RateLimiter Tests
// ─────────────────────────────────────────────────

func TestRateLimiter_AllowsWithinLimit(t *testing.T) {
	rl := NewRateLimiter(3, time.Minute)
	r := gin.New()
	r.Use(rl.Handler())
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	for i := 0; i < 3; i++ {
		w := performRequest(r, "GET", "/test", "")
		if w.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i+1, w.Code)
		}
	}
}

func TestRateLimiter_BlocksAfterLimit(t *testing.T) {
	rl := NewRateLimiter(2, time.Minute)
	r := gin.New()
	r.Use(rl.Handler())
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	performRequest(r, "GET", "/test", "")
	performRequest(r, "GET", "/test", "")

	w := performRequest(r, "GET", "/test", "")
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 after limit, got %d", w.Code)
	}
}

func TestRateLimiter_ResetsAfterWindow(t *testing.T) {
	rl := NewRateLimiter(1, 50*time.Millisecond)
	r := gin.New()
	r.Use(rl.Handler())
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	performRequest(r, "GET", "/test", "")
	// Second request within window -> blocked
	w := performRequest(r, "GET", "/test", "")
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 within window, got %d", w.Code)
	}

	// Wait for window to reset
	time.Sleep(80 * time.Millisecond)
	w = performRequest(r, "GET", "/test", "")
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 after window reset, got %d", w.Code)
	}
}

// helper
func contains(s, substr string) bool {
	return len(s) > 0 && len(substr) > 0 && len(s) >= len(substr) && (s == substr || len(s) > 0 && containsSubstring(s, substr))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
