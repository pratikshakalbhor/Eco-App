package routes

import (
	"time"

	"ecochain-backend/controllers"
	"ecochain-backend/middleware"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		// ── Rate Limiting ───────────────────────────────────────────
		// Per-IP fixed-window limits (in-memory, process-local).
		//   - Auth endpoints: stricter to mitigate brute-force/abuse.
		//   - Protected endpoints: generous to avoid breaking normal use.
		authLimiter := middleware.NewRateLimiter(20, time.Minute)
		verifyLimiter := middleware.NewRateLimiter(10, time.Minute)
		protectedLimiter := middleware.NewRateLimiter(120, time.Minute)
		marketplaceLimiter := middleware.NewRateLimiter(60, time.Minute)
		mediaLimiter := middleware.NewRateLimiter(20, time.Minute)

		// ── Auth Group (Public + rate limited) ──────────────────────
		auth := api.Group("/auth")
		{
			auth.GET("/nonce", authLimiter.Handler(), controllers.GetNonce)
			auth.POST("/verify", verifyLimiter.Handler(), controllers.VerifySignature)
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
		protected.Use(protectedLimiter.Handler())
		{
			protected.GET("/auth/me", controllers.GetMe)
			protected.GET("/user/stats", controllers.GetUserStats)
			protected.POST("/media/upload", mediaLimiter.Handler(), controllers.UploadToIPFS)
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
			protected.GET("/debt/all", controllers.GetAllDebts)
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
			}

			// ── Marketplace ──────────────────────────────
			protected.GET("/marketplace/listings", marketplaceLimiter.Handler(), controllers.GetMarketplaceListings)
			protected.POST("/marketplace/listings", marketplaceLimiter.Handler(), controllers.CreateMarketplaceListing)
			protected.POST("/marketplace/buy", marketplaceLimiter.Handler(), controllers.BuyCredits)
			protected.GET("/marketplace/transactions", marketplaceLimiter.Handler(), controllers.GetTransactions)
			protected.GET("/marketplace/stats", marketplaceLimiter.Handler(), controllers.GetMarketplaceStats)

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
