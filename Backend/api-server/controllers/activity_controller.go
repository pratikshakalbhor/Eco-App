package controllers

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GetRecentActivity — GET /api/activity/recent
func GetRecentActivity(c *gin.Context) {
	limit := 10
	logs := make([]models.ActivityLog, 0)

	if err := config.DB.Order("created_at desc").Limit(limit).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch activity logs"})
		return
	}

	c.JSON(http.StatusOK, logs)
}

// LogActivity is a helper to record events in the activity_log table
func LogActivity(eventType, treeID string, debtID *uuid.UUID, actor, description string) {
	LogActivityTx(config.DB, eventType, treeID, debtID, actor, description)
}

// LogActivityTx records an event in the activity_log table using the supplied
// transaction.
//
// Handlers that log while holding a write transaction MUST use this instead
// of LogActivity. Writing through the global connection from inside an open
// transaction is wrong for two reasons:
//
//  1. The log entry is committed independently, so it survives a rollback of
//     the change it describes — the audit trail can then disagree with the
//     data it claims to describe.
//  2. On SQLite the global connection is a *different* connection to the same
//     database, so the write blocks against the writer's own lock and
//     deadlocks.
func LogActivityTx(tx *gorm.DB, eventType, treeID string, debtID *uuid.UUID, actor, description string) {
	entry := models.ActivityLog{
		ID:          uuid.New(),
		EventType:   eventType, // TREE_PLANTED, TREE_VERIFIED, TREE_CUT, DEBT_CLEARED, etc.
		TreeID:      treeID,
		DebtID:      debtID,
		Actor:       actor,
		Description: description,
	}

	if err := tx.Create(&entry).Error; err != nil {
		log.Printf("Error logging activity: %v", err)
	}
}

// Helper to provide descriptive text for events
func FormatEventDescription(eventType, species, treeID string) string {
	switch eventType {
	case "TREE_PLANTED":
		return fmt.Sprintf("New %s tree planted (ID: %s)", species, treeID)
	case "TREE_VERIFIED":
		return fmt.Sprintf("%s tree verified and registered on-chain (ID: %s)", species, treeID)
	case "CUT_REPORTED":
		return fmt.Sprintf("Tree cut reported for %s (ID: %s)", species, treeID)
	case "CUT_CONFIRMED":
		return fmt.Sprintf("Tree cut confirmed for %s. Environmental loss recorded. (ID: %s)", species, treeID)
	case "DEBT_CLEARED":
		return fmt.Sprintf("Replantation debt resolved for original tree %s", treeID)
	default:
		return "Ecosystem event recorded"
	}
}
