package config

import (
	"fmt"
	"log"
	"os"
	"github.com/joho/godotenv"
	"ecochain-backend/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
	)

	database, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Auto-Migrate Models
	fmt.Println("Running Auto-Migration...")
	database.AutoMigrate(&models.User{}, &models.Tree{}, &models.CarbonCredit{}, &models.Verification{})

	DB = database
	fmt.Println("Connected to database successfully")
}
