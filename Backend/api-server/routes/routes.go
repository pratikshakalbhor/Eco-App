package routes

import (
	"ecochain-backend/controllers"
	"ecochain-backend/middleware"
	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		// Auth Routes
		auth := api.Group("/auth")
		{
			auth.GET("/nonce", controllers.GetNonce)
			auth.POST("/verify", controllers.VerifySignature)
		}

		// Protected Routes
		protected := api.Group("/")
		protected.Use(middleware.AuthMiddleware())
		{
			protected.GET("/auth/me", controllers.GetMe)
			// Tree Routes
			protected.POST("/trees", controllers.RegisterTree)
			protected.GET("/credits", controllers.GetUserCarbonCredits)
			protected.GET("/leaderboard", controllers.GetLeaderboard)
			
			// Verifier routes
			verifier := protected.Group("/")
			verifier.Use(middleware.RoleMiddleware("verifier", "admin"))
			{
				verifier.POST("/trees/:id/verify", controllers.VerifyTree)
			}

			// Admin routes
			admin := protected.Group("/")
			admin.Use(middleware.RoleMiddleware("admin"))
			{
				// admin.GET("/analytics", controllers.GetAnalytics)
			}
		}
	}
}
