package controllers

import (
	"math"
	"net/http"
	"testing"
	"time"

	"ecochain-backend/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// metersToLatitudeDegrees converts a distance in metres into a latitude
// offset using the same Earth radius the production code uses, so the tests
// can place a point at an exact distance from the tree.
func metersToLatitudeDegrees(meters float64) float64 {
	const earthRadiusMeters = 6371000.0
	return meters / (earthRadiusMeters * math.Pi / 180.0)
}

// ─────────────────────────────────────────────────
// calculateDistance
// ─────────────────────────────────────────────────

func TestCalculateDistance_IdenticalPointsIsZero(t *testing.T) {
	const lat, lon = 28.6139, 77.2090
	if d := calculateDistance(lat, lon, lat, lon); d != 0 {
		t.Errorf("expected 0 m for identical points, got %v", d)
	}
}

func TestCalculateDistance_NinetyNineMetresIsInsideTheGeofence(t *testing.T) {
	const lat, lon = 28.6139, 77.2090
	offset := metersToLatitudeDegrees(99)

	d := calculateDistance(lat+offset, lon, lat, lon)

	if d < 98.5 || d > 99.5 {
		t.Errorf("expected roughly 99 m, got %v", d)
	}
	if d > 100 {
		t.Errorf("a 99 m offset must be inside the 100 m geofence, got %v", d)
	}
}

func TestCalculateDistance_OneHundredAndOneMetresIsOutsideTheGeofence(t *testing.T) {
	const lat, lon = 28.6139, 77.2090
	offset := metersToLatitudeDegrees(101)

	d := calculateDistance(lat+offset, lon, lat, lon)

	if d < 100.5 || d > 101.5 {
		t.Errorf("expected roughly 101 m, got %v", d)
	}
	if d <= 100 {
		t.Errorf("a 101 m offset must be outside the 100 m geofence, got %v", d)
	}
}

func TestCalculateDistance_IsSymmetric(t *testing.T) {
	const lat1, lon1 = 28.6139, 77.2090
	const lat2, lon2 = 28.6239, 77.2190

	a := calculateDistance(lat1, lon1, lat2, lon2)
	b := calculateDistance(lat2, lon2, lat1, lon1)

	if math.Abs(a-b) > 1e-9 {
		t.Errorf("expected a symmetric distance, got %v and %v", a, b)
	}
}

func TestCalculateDistance_HandlesNegativeAndZeroCoordinates(t *testing.T) {
	// The southern/western hemispheres must not be special-cased incorrectly.
	d := calculateDistance(-33.8688, -151.2093, -33.8788, -151.2093)
	if d <= 0 || d > 1200 {
		t.Errorf("expected a positive distance in the expected range, got %v", d)
	}
}

// ─────────────────────────────────────────────────
// ReportCut
// ─────────────────────────────────────────────────

func createVerifiableTree(t *testing.T, db *gorm.DB, ownerWallet string) models.Tree {
	t.Helper()
	planter := createTestUser(t, db, ownerWallet, "user")
	tree := models.Tree{
		ID:                   uuid.New(),
		TreeID:               "TREE-CUT-" + uuid.New().String()[:8],
		PlanterID:            planter.ID,
		Species:              "oak",
		OwnerWallet:          ownerWallet,
		Latitude:             28.6139,
		Longitude:            77.2090,
		Status:               "VERIFIED",
		CarbonAbsorptionRate: 20.0,
		PlantedAt:            time.Now().AddDate(0, -3, 0),
		HealthStatus:         "Healthy",
	}
	if err := db.Create(&tree).Error; err != nil {
		t.Fatal("failed to create tree:", err)
	}
	return tree
}

func cutReportBody(tree models.Tree, accuracy float64) map[string]interface{} {
	return map[string]interface{}{
		"reason":      "Storm",
		"cut_date":    time.Now().Format("2006-01-02"),
		"latitude":    tree.Latitude,
		"longitude":   tree.Longitude,
		"accuracy":    accuracy,
		"description": "tree down after the storm",
	}
}

func TestReportCut_OwnerCanReportTheirOwnTree(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	tree := createVerifiableTree(t, db, "0xowner")

	r := setupIntegrityRouter(uuid.New(), "0xowner")
	r.POST("/api/trees/:id/report-cut", ReportCut)

	w := postJSON(t, r, "/api/trees/"+tree.TreeID+"/report-cut", cutReportBody(tree, 25))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for the owner, got %d: %s", w.Code, w.Body.String())
	}

	var reports int64
	db.Model(&models.CutReport{}).Where("tree_id = ?", tree.TreeID).Count(&reports)
	if reports != 1 {
		t.Errorf("expected 1 cut report, got %d", reports)
	}
}

func TestReportCut_RejectsAnotherUsersTree(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	victimTree := createVerifiableTree(t, db, "0xvictim")

	r := setupIntegrityRouter(uuid.New(), "0xattacker")
	r.POST("/api/trees/:id/report-cut", ReportCut)

	w := postJSON(t, r, "/api/trees/"+victimTree.TreeID+"/report-cut", cutReportBody(victimTree, 10))

	if w.Code != http.StatusNotFound && w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 or 404 for another user's tree, got %d: %s", w.Code, w.Body.String())
	}

	var reports int64
	db.Model(&models.CutReport{}).Count(&reports)
	if reports != 0 {
		t.Errorf("expected no cut report to be created, got %d", reports)
	}
}

func TestReportCut_RejectsAccuracyAbove25Metres(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	tree := createVerifiableTree(t, db, "0xowner")

	r := setupIntegrityRouter(uuid.New(), "0xowner")
	r.POST("/api/trees/:id/report-cut", ReportCut)

	w := postJSON(t, r, "/api/trees/"+tree.TreeID+"/report-cut", cutReportBody(tree, 26))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for an accuracy of 26 m, got %d: %s", w.Code, w.Body.String())
	}

	var reports int64
	db.Model(&models.CutReport{}).Count(&reports)
	if reports != 0 {
		t.Errorf("expected no cut report to be created, got %d", reports)
	}
}

func TestReportCut_AcceptsAccuracyOfExactly25Metres(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	tree := createVerifiableTree(t, db, "0xowner")

	r := setupIntegrityRouter(uuid.New(), "0xowner")
	r.POST("/api/trees/:id/report-cut", ReportCut)

	w := postJSON(t, r, "/api/trees/"+tree.TreeID+"/report-cut", cutReportBody(tree, 25))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for an accuracy of exactly 25 m, got %d: %s", w.Code, w.Body.String())
	}
}

func TestReportCut_RejectsMissingAccuracy(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	tree := createVerifiableTree(t, db, "0xowner")

	r := setupIntegrityRouter(uuid.New(), "0xowner")
	r.POST("/api/trees/:id/report-cut", ReportCut)

	body := cutReportBody(tree, 25)
	delete(body, "accuracy")

	w := postJSON(t, r, "/api/trees/"+tree.TreeID+"/report-cut", body)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when the accuracy is missing, got %d: %s", w.Code, w.Body.String())
	}
}

func TestReportCut_RejectsZeroAccuracy(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	tree := createVerifiableTree(t, db, "0xowner")

	r := setupIntegrityRouter(uuid.New(), "0xowner")
	r.POST("/api/trees/:id/report-cut", ReportCut)

	w := postJSON(t, r, "/api/trees/"+tree.TreeID+"/report-cut", cutReportBody(tree, 0))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for an accuracy of 0, got %d: %s", w.Code, w.Body.String())
	}
}

func TestReportCut_RejectsPositionOutsideTheGeofence(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	tree := createVerifiableTree(t, db, "0xowner")

	r := setupIntegrityRouter(uuid.New(), "0xowner")
	r.POST("/api/trees/:id/report-cut", ReportCut)

	body := cutReportBody(tree, 10)
	// ~101 m north of the tree.
	body["latitude"] = tree.Latitude + metersToLatitudeDegrees(101)

	w := postJSON(t, r, "/api/trees/"+tree.TreeID+"/report-cut", body)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for a position outside the 100 m geofence, got %d: %s", w.Code, w.Body.String())
	}
}

func TestReportCut_AcceptsPositionJustInsideTheGeofence(t *testing.T) {
	setupTestEnv(t)
	db := setupTestDB(t)

	tree := createVerifiableTree(t, db, "0xowner")

	r := setupIntegrityRouter(uuid.New(), "0xowner")
	r.POST("/api/trees/:id/report-cut", ReportCut)

	body := cutReportBody(tree, 10)
	// ~99 m north of the tree.
	body["latitude"] = tree.Latitude + metersToLatitudeDegrees(99)

	w := postJSON(t, r, "/api/trees/"+tree.TreeID+"/report-cut", body)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for a position 99 m from the tree, got %d: %s", w.Code, w.Body.String())
	}
}
