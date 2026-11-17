package main

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
)

// Usage:
//
//	go run scripts/promote_user/main.go <wallet-address> [role]
//
// role is one of user, verifier, admin and defaults to verifier. The role only
// changes the API authorization; the wallet still needs the matching on-chain
// role (VERIFIER_ROLE) before it can submit verification transactions.
func main() {
	if len(os.Args) < 2 {
		log.Fatal("usage: go run scripts/promote_user/main.go <wallet-address> [user|verifier|admin]")
	}

	address := os.Args[1]
	role := "verifier"
	if len(os.Args) > 2 {
		role = os.Args[2]
	}
	switch role {
	case "user", "verifier", "admin":
	default:
		log.Fatalf("invalid role %q: expected user, verifier or admin", role)
	}

	if err := godotenv.Load(".env"); err != nil {
		if err := godotenv.Load("../.env"); err != nil {
			log.Fatal("Error loading .env file")
		}
	}

	config.InitDB()

	var user models.User
	if err := config.DB.Where("LOWER(wallet_address) = LOWER(?)", address).First(&user).Error; err != nil {
		fmt.Printf("User %s not found in database.\n", address)
		return
	}

	user.Role = role
	if err := config.DB.Save(&user).Error; err != nil {
		log.Fatal("Failed to update user role:", err)
	}

	fmt.Printf("Successfully promoted %s to %s!\n", address, role)
	fmt.Println("The user must log out and log back in: the JWT is issued with the role that existed at login time.")
}
