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

		// ── Public Routes ────────────────────────────────────────────
		// IMPORTANT: Static paths MUST come before :id wildcard in Gin
		api.GET("/trees", controllers.GetAllTrees)
		api.GET("/trees/all", controllers.GetTreeAllPublic)        // Map page — public
		api.GET("/trees/stats", controllers.GetTreeStats)           // must be before /trees/:id
		api.GET("/environment/stats", controllers.GetEnvironmentStats)
		api.GET("/environment/monthly-stats", controllers.GetMonthlyStats)
		api.GET("/environment/species-stats", controllers.GetSpeciesStats)
		api.GET("/activity/recent", controllers.GetRecentActivity)
		api.GET("/trees/:id", controllers.GetTreeByID)              // wildcard last
		api.GET("/trees/:id/history", controllers.GetTreeHistory)   // lifecycle timeline

		// ── Protected Context ───────────────────────────────────────
		protected := api.Group("/")
		protected.Use(middleware.AuthMiddleware())
		{
			protected.GET("/auth/me", controllers.GetMe)
			protected.GET("/user/stats", controllers.GetUserStats)
			protected.POST("/media/upload", controllers.UploadToIPFS)
			protected.GET("/notifications", controllers.GetNotifications)

			// ── Tree Lifecycle ───────────────────────────
			protected.POST("/trees", controllers.RegisterTree)
			// Static sub-paths first, then wildcard
			protected.GET("/trees/my", controllers.GetMyTrees)
			protected.POST("/trees/:id/report-cut", controllers.ReportCut)
			protected.GET("/trees/:id/loss", controllers.GetEnvironmentalLoss)
			protected.PATCH("/trees/:id/growth", controllers.UpdateTreeGrowth)

			// ── Replantation Debt ────────────────────────
			protected.GET("/debt", controllers.GetMyDebts)
			protected.GET("/debt/:id", controllers.GetDebtByID)
			protected.POST("/debt/:id/link-tree", controllers.LinkTreeToDebt)
			protected.GET("/debt/:id/certificate", controllers.GetCertificateData)

			// ── Verifier Routes ──────────────────────────
			verifier := protected.Group("/")
			verifier.Use(middleware.RoleMiddleware("verifier", "admin"))
			{
				// Static paths before wildcard
				verifier.GET("/trees/pending", controllers.GetPendingTrees)
				verifier.GET("/trees/cut-reports", controllers.GetCutReports)
				verifier.POST("/trees/:id/verify", controllers.VerifyTree)
				verifier.POST("/trees/:id/cut/confirm", controllers.ConfirmCut)
				verifier.POST("/trees/:id/cut/reject", controllers.RejectCut)
				verifier.GET("/debt/all", controllers.GetAllDebts)
			}

			// ── Marketplace ──────────────────────────────
			protected.GET("/marketplace/listings", controllers.GetMarketplaceListings)
			protected.POST("/marketplace/listings", controllers.CreateMarketplaceListing)
			protected.POST("/marketplace/buy", controllers.BuyCredits)
			protected.GET("/marketplace/transactions", controllers.GetTransactions)
			protected.GET("/marketplace/stats", controllers.GetMarketplaceStats)

			// ── Credits & Balance ────────────────────────
			protected.GET("/credits/balance", controllers.GetCreditBalance)
			protected.GET("/credits/history", controllers.GetCreditHistory)
			protected.POST("/credits/burn", controllers.BurnCarbonCredits)

			// ── Carbon Accountability (user-level) ───────
			protected.GET("/credits", controllers.GetUserCarbonCredits)

			// ── Admin Routes ─────────────────────────────
			admin := protected.Group("/admin")
			admin.Use(middleware.RoleMiddleware("admin"))
			{
				admin.GET("/stats", controllers.GetAdminStats)
				admin.GET("/users", controllers.GetAllUsers)
				admin.PUT("/users/:id/role", controllers.UpdateUserRole)
			}
		}
	}
}
