package main

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"fmt"
	"log"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(".env"); err != nil {
		if err := godotenv.Load("../.env"); err != nil {
			log.Fatal("Error loading .env file")
		}
	}

	config.InitDB()
	
	address := "0x22b94a9953db57760ef54f010ba304a79bfabed2"
	var user models.User
	if err := config.DB.Where("LOWER(wallet_address) = LOWER(?)", address).First(&user).Error; err != nil {
		fmt.Printf("User %s not found in database.\n", address)
		return
	}

	user.Role = "admin"
	if err := config.DB.Save(&user).Error; err != nil {
		log.Fatal("Failed to update user role:", err)
	}

	fmt.Printf("Successfully promoted %s to admin!\n", address)
}
