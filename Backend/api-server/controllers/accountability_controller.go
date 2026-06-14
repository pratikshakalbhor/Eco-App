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

// ReportTreeCut — Legacy handler kept for backward compat. Prefer cut_controller.go ReportCut.
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

	var tree models.Tree
	if err := config.DB.First(&tree, "id = ?", treeID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tree not found"})
		return
	}

	// Removed IsCut check as field was deleted from model
	userIDString, _ := c.Get("userID")
	reporterID, _ := uuid.Parse(userIDString.(string))

	report := models.CutReport{
		ID:               uuid.New(),
		TreeID:           tree.TreeID,
		OwnerWallet:      tree.OwnerWallet,
		Reason:           input.Reason,
		EvidenceImageURL: input.EvidenceURL,
		Status:           "PENDING",
		CreatedAt:        time.Now(),
	}

	if err := config.DB.Create(&report).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create cut report"})
		return
	}

	_ = reporterID
	c.JSON(http.StatusOK, report)
}

// GetPendingCutReports — Legacy handler, lists pending CutReports for admin
func GetPendingCutReports(c *gin.Context) {
	var reports []models.CutReport
	if err := config.DB.Preload("Tree").Where("status = ?", "PENDING").Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reports"})
		return
	}
	c.JSON(http.StatusOK, reports)
}

// VerifyCutReport — Legacy handler for admin to approve/reject a cut report by report ID
func VerifyCutReport(c *gin.Context) {
	reportID := c.Param("id")
	var input struct {
		Status string `json:"status" binding:"required"` // approved, rejected
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var report models.CutReport
	if err := config.DB.First(&report, "id = ?", reportID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Report not found"})
		return
	}

	if report.Status != "PENDING" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Report has already been processed"})
		return
	}

	tx := config.DB.Begin()

	report.Status = input.Status
	if input.Status == "approved" {
		var tree models.Tree
		if err := tx.First(&tree, "tree_id = ?", report.TreeID).Error; err == nil {
			impact := services.CalculateEnvironmentalLoss(tree)
			_ = impact

			// 2. Update Tree Status
			tree.Status = "CUT_CONFIRMED"
			// tree.CutAt = &now // Field removed from model
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
