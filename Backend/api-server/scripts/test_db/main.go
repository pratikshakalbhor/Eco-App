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
		if err := godotenv.Load("../.env"); err != nil {
			log.Fatal("Error loading .env file")
		}
	}

	// Initialize Database using project config
	config.InitDB()
	db := config.DB

	fmt.Println("\n=== EcoChain Database Inspection ===")

	var tables []string
	db.Raw("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'").Scan(&tables)
	
	if len(tables) == 0 {
		fmt.Println("No tables found in public schema.")
		return
	}

	for _, table := range tables {
		var columns []struct {
			ColumnName string
			DataType   string
		}
		db.Raw("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ?", table).Scan(&columns)
		
		fmt.Printf("\n[Table: %s]\n", table)
		for _, col := range columns {
			fmt.Printf("  - %-20s | %s\n", col.ColumnName, col.DataType)
		}
	}
	fmt.Println("\n====================================")
}
