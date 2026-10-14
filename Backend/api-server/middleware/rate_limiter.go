package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter is a simple in-memory fixed-window rate limiter keyed by client
// IP. It is process-local (not shared across instances) — suitable for
// protecting against accidental abuse and brute-force on auth endpoints. For a
// multi-instance deployment, replace with a shared store (e.g. Redis).
type RateLimiter struct {
	mu       sync.Mutex
	window   time.Duration
	max      int
	hits     map[string]int
	windowAt map[string]time.Time
}

// NewRateLimiter returns a limiter allowing up to `max` requests per `window`
// per IP address.
func NewRateLimiter(max int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		window:   window,
		max:      max,
		hits:     make(map[string]int),
		windowAt: make(map[string]time.Time),
	}
}

// Handler returns a gin handler that enforces the limit and returns 429 when
// the limit is exceeded.
func (rl *RateLimiter) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.ClientIP()

		rl.mu.Lock()
		now := time.Now()

		// Reset the window for this key if it has elapsed.
		if start, ok := rl.windowAt[key]; !ok || now.Sub(start) >= rl.window {
			rl.hits[key] = 0
			rl.windowAt[key] = now
		}

		rl.hits[key]++
		count := rl.hits[key]
		rl.mu.Unlock()

		if count > rl.max {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "Too many requests. Please try again later.",
			})
			return
		}

		c.Next()
	}
}
