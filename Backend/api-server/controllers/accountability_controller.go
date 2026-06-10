package controllers

import (
	"ecochain-backend/config"
	"ecochain-backend/models"
	"ecochain-backend/services"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ReportTreeCut handles the submission of a tree cutting report
func ReportTreeCut(c *gin.Context) {
	treeID := c.Param("id")
	var input struct {
		Reason      string `json:"reason" binding:"required"`
		EvidenceURL string `json:"evidence_url" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. Verify tree exists
	var tree models.Tree
	if err := config.DB.First(&tree, "id = ?", treeID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tree not found"})
		return
	}

	// Removed IsCut check as field was deleted from model

	userIDString, _ := c.Get("userID")
	reporterID, _ := uuid.Parse(userIDString.(string))

	// 2. Create the report
	report := models.TreeCutReport{
		ID:          uuid.New(),
		TreeID:      tree.ID,
		ReporterID:  reporterID,
		Reason:      input.Reason,
		EvidenceURL: input.EvidenceURL,
		Status:      "pending",
		CreatedAt:   time.Now(),
	}

	if err := config.DB.Create(&report).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create cut report"})
		return
	}

	c.JSON(http.StatusOK, report)
}

// GetPendingCutReports lists reports awaiting verifier approval
func GetPendingCutReports(c *gin.Context) {
	var reports []models.TreeCutReport
	if err := config.DB.Where("status = ?", "pending").Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reports"})
		return
	}
	c.JSON(http.StatusOK, reports)
}

// VerifyCutReport handles the approval or rejection of a cutting report
func VerifyCutReport(c *gin.Context) {
	reportID := c.Param("id")
	var input struct {
		Status string `json:"status" binding:"required"` // approved, rejected
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var report models.TreeCutReport
	if err := config.DB.First(&report, "id = ?", reportID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Report not found"})
		return
	}

	if report.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Report has already been processed"})
		return
	}

	tx := config.DB.Begin()

	// 1. Update Report Status
	report.Status = input.Status
	if input.Status == "approved" {
		// Calculate Environmental Loss
		var tree models.Tree
		if err := tx.First(&tree, "id = ?", report.TreeID).Error; err == nil {
			impact := services.CalculateEnvironmentalLoss(tree)
			report.LossAmount = impact.CarbonLoss
			report.OxygenLoss = impact.OxygenLoss
			report.CompensationRatio = impact.CompensationRatio
			report.RequiredTrees = impact.RequiredTrees

			// 2. Update Tree Status
			// 2. Update Tree Status
			tree.Status = "cut"
			now := time.Now()
			tree.CutAt = &now
			tx.Save(&tree)
		}
	}

	if err := tx.Save(&report).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update report"})
		return
	}

	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "Cut report verification completed", "report": report})
}
