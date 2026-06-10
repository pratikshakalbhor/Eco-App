package routes

import (
	"ecochain-backend/controllers"
	"ecochain-backend/middleware"
	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		// Auth Group (Public)
		auth := api.Group("/auth")
		{
			auth.GET("/nonce", controllers.GetNonce)
			auth.POST("/verify", controllers.VerifySignature)
		}

		// Public Eco Data
		api.GET("/trees", controllers.GetAllTrees)

		// Protected Context
		protected := api.Group("/")
		protected.Use(middleware.AuthMiddleware())
		{
			protected.GET("/auth/me", controllers.GetMe)
			protected.GET("/user/stats", controllers.GetUserStats)
			
			// Tree Lifecycle Routes
			protected.POST("/trees", controllers.RegisterTree)
			protected.GET("/trees/my", controllers.GetMyTrees)
			protected.GET("/trees/:id", controllers.GetTreeByID)
			
			// Verifier routes
			verifier := protected.Group("/")
			verifier.Use(middleware.RoleMiddleware("verifier", "admin"))
			{
				verifier.GET("/trees/pending", controllers.GetPendingTrees)
				verifier.POST("/trees/:id/verify", controllers.VerifyTree)
				
				// Cut Verification Stage 2
				verifier.GET("/cut-reports/pending", controllers.GetPendingCutReports)
				verifier.POST("/cut-reports/:id/verify", controllers.VerifyCutReport)
			}

			// Admin routes
			admin := protected.Group("/")
			admin.Use(middleware.RoleMiddleware("admin"))
			{
				admin.PUT("/users/:id/role", controllers.UpdateUserRole)
			}
		}
	}
}
