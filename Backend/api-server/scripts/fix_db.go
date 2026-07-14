package main

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"fmt"
	"log"

	"github.com/google/uuid"
)

func main() {
	config.InitDB()
	db := config.DB

	fmt.Println("Repairing database...")

	// 1. Fix NULL tree_ids in trees table
	var trees []models.Tree
	if err := db.Where("tree_id IS NULL OR tree_id = ''").Find(&trees).Error; err != nil {
		log.Fatal("Failed to fetch trees with null tree_id:", err)
	}

	fmt.Printf("Found %d trees with missing tree_id\n", len(trees))
	for _, t := range trees {
		newID := fmt.Sprintf("TREE-%s", uuid.New().String()[:8])
		if err := db.Model(&t).Update("tree_id", newID).Error; err != nil {
			log.Printf("Failed to update tree %s: %v", t.ID, err)
		} else {
			fmt.Printf("Assigned %s to tree %s\n", newID, t.ID)
		}
	}

	// 2. Try to add unique constraint manually if AutoMigrate failed
	// This depends on the DB type (Postgres in this case)
	err := db.Exec("ALTER TABLE trees ADD CONSTRAINT uni_trees_tree_id UNIQUE (tree_id)").Error
	if err != nil {
		fmt.Printf("Note: Could not add unique constraint manually (might already exist): %v\n", err)
	}

	// 3. Run AutoMigrate again for all models
	fmt.Println("Running Auto-Migration again...")
	if err := db.AutoMigrate(
		&models.User{},
		&models.Tree{},
		&models.CarbonCredit{},
		&models.Verification{},
		&models.CutReport{},
		&models.EnvironmentalLoss{},
		&models.ReplantationDebt{},
		&models.ReplacementTree{},
		&models.CompensationRecord{},
		&models.ActivityLog{},
		&models.RestorationCertificate{},
	); err != nil {
		log.Printf("Warning: Final AutoMigrate error: %v", err)
	}

	fmt.Println("Database repair complete.")
}
