package config

import (
	"testing"

	"ecochain-backend/models"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func setupIndexTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{TranslateError: true})
	if err != nil {
		t.Fatal("failed to open test db:", err)
	}
	db.AutoMigrate(
		&models.User{}, &models.Tree{}, &models.CarbonCredit{},
		&models.Verification{}, &models.CutReport{}, &models.EnvironmentalLoss{},
		&models.ReplantationDebt{}, &models.ReplacementTree{}, &models.CompensationRecord{},
		&models.ActivityLog{}, &models.RestorationCertificate{},
		&models.MarketplaceListing{}, &models.MarketplaceTransaction{}, &models.CreditLedger{},
	)
	sqlDB, err := db.DB()
	if err == nil {
		t.Cleanup(func() { sqlDB.Close() })
	}
	return db
}

func indexExists(t *testing.T, db *gorm.DB, name string) bool {
	t.Helper()
	var sql string
	if err := db.Raw(`SELECT sql FROM sqlite_master WHERE type='index' AND name = ?`, name).
		Scan(&sql).Error; err != nil {
		t.Fatalf("failed to look up index %s: %v", name, err)
	}
	return sql != ""
}

func TestCreateIntegrityIndexes_CreatesAllIndexes(t *testing.T) {
	db := setupIndexTestDB(t)

	createIntegrityIndexes(db)

	for _, spec := range integrityIndexes {
		if !indexExists(t, db, spec.Name) {
			t.Errorf("expected index %s to be created on %s", spec.Name, spec.Table)
		}
	}
}

func TestReportIntegrityDuplicates_ReportsDuplicatesInsteadOfFailingSilently(t *testing.T) {
	db := setupIndexTestDB(t)

	// Drop the index that AutoMigrate created from the model tag, so that
	// the legacy state — a database that already holds duplicates — can be
	// reproduced.
	db.Exec(`DROP INDEX IF EXISTS uni_carbon_credits_tree_id_type`)

	treeID := uuid.New()
	userID := uuid.New()
	for i := 0; i < 2; i++ {
		if err := db.Create(&models.CarbonCredit{
			ID:        uuid.New(),
			UserID:    userID,
			TreeID:    treeID,
			Amount:    1,
			Type:      "verification_reward",
			Tradeable: true,
		}).Error; err != nil {
			t.Fatalf("failed to seed the duplicate rows: %v", err)
		}
	}

	// The duplicate check must report the offending rows...
	reportIntegrityDuplicates(db)

	// ...and the index creation must fail loudly rather than silently
	// leaving the invariant unenforced.
	createIntegrityIndexes(db)

	if indexExists(t, db, "uni_carbon_credits_tree_id_type") {
		t.Error("expected the unique index NOT to be created while duplicates exist")
	}

	// The other indexes are unaffected by this duplicate and must still be
	// created.
	if !indexExists(t, db, "uni_replacement_trees_tree_id") {
		t.Error("expected the unaffected indexes to still be created")
	}
}

func TestCreateIntegrityIndexes_IgnoresBurnRowsInTheTreeTypeIndex(t *testing.T) {
	db := setupIndexTestDB(t)
	db.Exec(`DROP INDEX IF EXISTS uni_carbon_credits_tree_id_type`)

	// Burn rows are not attributed to a tree (they carry the zero tree id) so
	// several of them may legitimately exist for the same user.
	for i := 0; i < 3; i++ {
		if err := db.Create(&models.CarbonCredit{
			ID:              uuid.New(),
			UserID:          uuid.New(),
			TreeID:          uuid.Nil,
			Amount:          -1,
			Type:            "burned",
			Tradeable:       false,
			TransactionHash: "0xburn" + string(rune('a'+i)),
		}).Error; err != nil {
			t.Fatalf("failed to seed burn rows: %v", err)
		}
	}

	createIntegrityIndexes(db)

	if !indexExists(t, db, "uni_carbon_credits_tree_id_type") {
		t.Error("expected the (tree_id, type) index to be created: burn rows must be excluded from it")
	}
}
