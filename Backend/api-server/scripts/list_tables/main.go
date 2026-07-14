package main

import (
	"ecochain-backend/config"
	"fmt"
	"log"

	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(".env"); err != nil {
		// Try parent dir if running from scripts/
		if err := godotenv.Load("../.env"); err != nil {
			log.Fatal("Error loading .env file from root or parent")
		}
	}

	// Initialize Database
	config.InitDB()

	// List all tables in the public schema
	var tables []string
	config.DB.Raw("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'").Scan(&tables)

	fmt.Println("\n=== EcoChain Database Tables ===")
	if len(tables) == 0 {
		fmt.Println("No tables found in public schema.")
	} else {
		for _, table := range tables {
			fmt.Printf(" [✓] %s\n", table)
		}
	}
	fmt.Println("================================\n")
}
