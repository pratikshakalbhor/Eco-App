package routes

import (
	"ecochain-backend/controllers"
	"ecochain-backend/middleware"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		// ── Auth Group (Public) ─────────────────────────────────────
		auth := api.Group("/auth")
		{
			auth.GET("/nonce", controllers.GetNonce)
			auth.POST("/verify", controllers.VerifySignature)
		}

		// ── Public: Read All Trees ──────────────────────────────────
		api.GET("/trees", controllers.GetAllTrees)
		api.GET("/environment/stats", controllers.GetEnvironmentStats)
		api.GET("/environment/monthly-stats", controllers.GetMonthlyStats)
		api.GET("/environment/species-stats", controllers.GetSpeciesStats)
		api.GET("/activity/recent", controllers.GetRecentActivity)
		api.GET("/trees/:id", controllers.GetTreeByID)
		api.GET("/trees/stats", controllers.GetTreeStats)

		// ── Protected Context ───────────────────────────────────────
		protected := api.Group("/")
		protected.Use(middleware.AuthMiddleware())
		{
			protected.GET("/auth/me", controllers.GetMe)
			protected.GET("/user/stats", controllers.GetUserStats)

			// ── Tree Lifecycle ───────────────────────────
			protected.POST("/trees", controllers.RegisterTree)
			protected.GET("/trees/my", controllers.GetMyTrees)
			protected.GET("/trees/stats", controllers.GetTreeStats)
			protected.GET("/trees/:id", controllers.GetTreeByID)

			// ── Tree Cut (User) ──────────────────────────
			protected.POST("/trees/:id/report-cut", controllers.ReportCut)
			protected.GET("/trees/:id/loss", controllers.GetEnvironmentalLoss)

			// ── Replantation Debt ────────────────────────
			protected.GET("/debt", controllers.GetMyDebts)
			protected.GET("/debt/:id", controllers.GetDebtByID)
			protected.POST("/debt/:id/link-tree", controllers.LinkTreeToDebt)
			protected.GET("/debt/:id/certificate", controllers.GetCertificateData)

			// ── Verifier Routes ──────────────────────────
			verifier := protected.Group("/")
			verifier.Use(middleware.RoleMiddleware("verifier", "admin"))
			{
				verifier.GET("/trees/pending", controllers.GetPendingTrees)
				verifier.POST("/trees/:id/verify", controllers.VerifyTree)

				// Cut report verification (admin)
				verifier.GET("/trees/cut-reports", controllers.GetCutReports)
				verifier.POST("/trees/:id/cut/confirm", controllers.ConfirmCut)
				verifier.POST("/trees/:id/cut/reject", controllers.RejectCut)
				verifier.GET("/debt/all", controllers.GetAllDebts)
			}

			// ── Admin Routes ─────────────────────────────
			admin := protected.Group("/")
			admin.Use(middleware.RoleMiddleware("admin"))
			{
				admin.PUT("/users/:id/role", controllers.UpdateUserRole)
			}
		}
	}
}
