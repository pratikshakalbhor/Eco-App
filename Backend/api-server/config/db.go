package config

import (
	"fmt"
	"log"
	"os"
	"github.com/joho/godotenv"
	"ecochain-backend/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	sslMode := os.Getenv("DB_SSLMODE")
	if sslMode == "" {
		sslMode = "require"
	}

	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=UTC",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
		sslMode,
	)

	// PreferSimpleProtocol disables prepared statements, required for
	// Supabase PgBouncer (transaction pooler on port 6543)
	dialector := postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true,
	})

	database, err := gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Auto-Migrate Models
	fmt.Println("Running Auto-Migration...")
	if err := database.AutoMigrate(&models.User{}, &models.Tree{}, &models.CarbonCredit{}, &models.Verification{}, &models.TreeCutReport{}, &models.CompensationRecord{}); err != nil {
		log.Printf("Warning: AutoMigrate error: %v", err)
	}

	DB = database
	fmt.Println("Connected to database successfully")
}
