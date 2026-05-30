package controllers

import (
	"ecochain-backend/config"
	"net/http"
	"github.com/gin-gonic/gin"
)

type LeaderboardEntry struct {
	ID            string `json:"id"`
	FullName      string `json:"full_name"`
	XPPoints      int    `json:"xp_points"`
	Level         int    `json:"level"`
	VerifiedTrees int    `json:"verified_trees"`
}

func GetLeaderboard(c *gin.Context) {
	var entries []LeaderboardEntry

	// Simplified raw query for demo/performance
	query := `
		SELECT u.id, u.full_name, u.xp_points, u.level, COUNT(t.id) as verified_trees
		FROM users u
		LEFT JOIN trees t ON u.id = t.planter_id AND t.status = 'verified'
		GROUP BY u.id
		ORDER BY u.xp_points DESC
		LIMIT 10
	`

	if err := config.DB.Raw(query).Scan(&entries).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch leaderboard"})
		return
	}

	c.JSON(http.StatusOK, entries)
}
