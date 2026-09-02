package main

import (
	"ecochain-backend/config"
	"ecochain-backend/routes"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file, using system env")
	}

	// Initialize Database
	config.InitDB()

	// Initialize Gin Router
	r := gin.Default()

	// Configure CORS
	//
	// Origins are read from CORS_ORIGINS (comma-separated) so each
	// environment can specify its own allowlist. Local development hosts are
	// included by default. NEVER use "*" here because authenticated requests
	// carry credentials (Authorization header / cookies).
	allowedOrigins := []string{"http://localhost:5173", "http://localhost:3000"}
	if extra := os.Getenv("CORS_ORIGINS"); extra != "" {
		for _, o := range strings.Split(extra, ",") {
			o = strings.TrimSpace(o)
			if o != "" {
				allowedOrigins = append(allowedOrigins, o)
			}
		}
	}

	r.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Setup Routes
	routes.SetupRoutes(r)

	// Start Server
	log.Println("EcoChain Backend running on http://localhost:8080")
	r.Run(":8080")
}
