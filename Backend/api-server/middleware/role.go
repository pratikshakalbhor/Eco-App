package middleware

import (
	"log"
	"net/http"
	"github.com/gin-gonic/gin"
)

// RoleMiddleware checks if the authenticated user has one of the required roles.
func RoleMiddleware(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract role from context (set by AuthMiddleware)
		role, exists := c.Get("role")
		
		if !exists {
			log.Println("[RoleMiddleware] ERROR: Role not found in context")
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: user role missing"})
			c.Abort()
			return
		}

		userRole, ok := role.(string)
		if !ok {
			log.Println("[RoleMiddleware] ERROR: Role context is not a string")
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: invalid role format"})
			c.Abort()
			return
		}

		log.Printf("[RoleMiddleware] Checking access: userRole=%s, allowed=%v", userRole, allowedRoles)

		// Check if user's role is in the allowed list
		isAllowed := false
		for _, r := range allowedRoles {
			if userRole == r {
				isAllowed = true
				break
			}
		}

		if !isAllowed {
			log.Printf("[RoleMiddleware] ACCESS DENIED: userRole=%s does not match any of %v", userRole, allowedRoles)
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Forbidden: insufficient permissions",
				"details": gin.H{
					"current_role": userRole,
					"required":     allowedRoles,
				},
			})
			c.Abort()
			return
		}

		log.Printf("[RoleMiddleware] ACCESS GRANTED: %s", userRole)
		c.Next()
	}
}
