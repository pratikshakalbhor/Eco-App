package config

import (
	"ecochain-backend/models"
	"fmt"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"log"
	"os"
	"strings"
)

var DB *gorm.DB

func InitDB() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	sslMode := os.Getenv("DB_SSLMODE")
	if sslMode == "" {
		sslMode = "require"
	}

	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=UTC",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
		sslMode,
	)

	// PreferSimpleProtocol disables prepared statements, required for
	// Supabase PgBouncer (transaction pooler on port 6543)
	dialector := postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true,
	})

	database, err := gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
		// TranslateError maps native constraint violations (PostgreSQL
		// "duplicate key", SQLite "UNIQUE constraint failed") onto
		// gorm.ErrDuplicatedKey so handlers can distinguish a replayed
		// marketplace transaction from a generic write failure.
		TranslateError: true,
	})
	if err != nil {
		log.Println("WARNING: Failed to connect to Postgres database, falling back to local SQLite (ecochain.db):", err)
		database, err = gorm.Open(sqlite.Open("ecochain.db"), &gorm.Config{
			Logger:         logger.Default.LogMode(logger.Warn),
			TranslateError: true,
		})
		if err != nil {
			log.Fatal("Failed to connect to both Postgres and SQLite databases:", err)
		}
	}

	// Register global UUID generator callback for all GORM models
	database.Callback().Create().Before("gorm:create").Register("uuid_generator", func(tx *gorm.DB) {
		if tx.Statement.Schema != nil {
			for _, field := range tx.Statement.Schema.Fields {
				if field.Name == "ID" && field.StructField.Type.String() == "uuid.UUID" {
					val, isZero := field.ValueOf(tx.Statement.Context, tx.Statement.ReflectValue)
					if isZero || val.(uuid.UUID) == uuid.Nil {
						field.Set(tx.Statement.Context, tx.Statement.ReflectValue, uuid.New())
					}
				}
			}
		}
	})

	// Report any rows that already violate the integrity invariants BEFORE
	// the indexes are created. This has to happen before AutoMigrate: on a
	// legacy database that already holds duplicates, AutoMigrate's attempt to
	// create the index fails and the invariant would silently be left
	// unenforced.
	reportIntegrityDuplicates(database)

	// Auto-Migrate Models individually to ensure one failure doesn't block others
	fmt.Println("Running Auto-Migration...")

	// Drop incorrect FK constraint from previous buggy model definitions.
	// The bidirectional Tree<->CutReport association caused GORM to create
	// fk_cut_reports_tree on trees.tree_id → cut_reports.tree_id, which is
	// backwards (it forces every tree to have a cut report before insert).
	database.Exec(`ALTER TABLE "trees" DROP CONSTRAINT IF EXISTS "fk_cut_reports_tree"`)

	migrateModels := []interface{}{
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
		&models.MarketplaceListing{},
		&models.MarketplaceTransaction{},
		&models.CreditLedger{},
	}

	for _, model := range migrateModels {
		if err := database.AutoMigrate(model); err != nil {
			log.Printf("Warning: AutoMigrate error for %T: %v", model, err)
		}
	}

	// Ensure the unique indexes that back the platform's integrity
	// invariants exist on legacy databases as well as freshly migrated ones.
	createIntegrityIndexes(database)

	DB = database
	fmt.Println("Connected to database successfully")
}

// uniqueIndexSpec describes a unique index that enforces an integrity
// invariant.
type uniqueIndexSpec struct {
	// Name is the index name.
	Name string
	// Table is the table the index is created on.
	Table string
	// Columns is the comma separated list of indexed columns.
	Columns string
	// Predicate is an optional WHERE clause restricting the index to the
	// rows the invariant applies to (for example "type <> 'burned'").
	Predicate string
}

// integrityIndexes are the unique indexes that make the double-counting,
// replay and replantation invariants enforceable by the database rather than
// by application logic alone.
var integrityIndexes = []uniqueIndexSpec{
	{
		Name:      "uni_marketplace_transactions_tx_hash",
		Table:     "marketplace_transactions",
		Columns:   "tx_hash",
		Predicate: "tx_hash IS NOT NULL AND tx_hash <> ''",
	},
	{
		Name:      "uni_carbon_credits_tree_id_type",
		Table:     "carbon_credits",
		Columns:   "tree_id, type",
		Predicate: "type <> 'burned'",
	},
	{
		Name:      "uni_carbon_credits_transaction_hash",
		Table:     "carbon_credits",
		Columns:   "transaction_hash",
		Predicate: "transaction_hash IS NOT NULL AND transaction_hash <> ''",
	},
	{
		Name:      "uni_replacement_trees_tree_id",
		Table:     "replacement_trees",
		Columns:   "tree_id",
		Predicate: "",
	},
	{
		Name:      "uni_trees_blockchain_token_id",
		Table:     "trees",
		Columns:   "blockchain_token_id",
		Predicate: "blockchain_token_id IS NOT NULL AND blockchain_token_id <> ''",
	},
}

// reportIntegrityDuplicates prints the rows that already violate each
// integrity invariant.
//
// This runs BEFORE the indexes are created so that an operator is told which
// rows are blocking them. Without it, a database that already holds
// duplicates would simply fail to create the index and the invariant would
// be left silently unenforced.
func reportIntegrityDuplicates(database *gorm.DB) {
	for _, spec := range integrityIndexes {
		if !tableExists(database, spec.Table) {
			// Fresh database: the table does not exist yet.
			continue
		}
		reportDuplicateRows(database, spec)
	}
}

// createIntegrityIndexes creates the unique indexes that enforce the
// platform's integrity invariants.
//
// An existing index with the right name but the wrong columns is dropped and
// recreated: an early release tagged only carbon_credits.type with the
// composite index name, producing a single-column index that allowed just one
// credit of each type in the whole table.
func createIntegrityIndexes(database *gorm.DB) {
	for _, spec := range integrityIndexes {
		if def := indexDefinition(database, spec.Name); def != "" && !indexHasColumns(def, spec.Columns) {
			log.Printf("WARNING: index %s has the wrong columns (%s); recreating it on (%s)",
				spec.Name, def, spec.Columns)
			if err := database.Exec(fmt.Sprintf("DROP INDEX IF EXISTS %s", spec.Name)).Error; err != nil {
				log.Printf("ERROR: could not drop the outdated index %s: %v", spec.Name, err)
			}
		}

		statement := fmt.Sprintf(
			"CREATE UNIQUE INDEX IF NOT EXISTS %s ON %s (%s)", spec.Name, spec.Table, spec.Columns)
		if spec.Predicate != "" {
			statement += " WHERE " + spec.Predicate
		}

		if err := database.Exec(statement).Error; err != nil {
			log.Printf("ERROR: could not create unique index %s: %v", spec.Name, err)
			log.Printf("       The invariant enforced by %s is NOT active until the duplicates are resolved and the index is created.", spec.Name)
			continue
		}
		log.Printf("Integrity index %s active on %s (%s)", spec.Name, spec.Table, spec.Columns)
	}
}

// indexDefinition returns the backend's definition of an index, or "" when it
// does not exist. It understands both supported backends.
func indexDefinition(database *gorm.DB, name string) string {
	var def string
	if err := database.Raw(
		`SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?`, name,
	).Scan(&def).Error; err == nil && def != "" {
		return def
	}

	def = ""
	if err := database.Raw(
		`SELECT indexdef FROM pg_indexes WHERE indexname = ?`, name,
	).Scan(&def).Error; err == nil {
		return def
	}
	return ""
}

// indexHasColumns reports whether def mentions every column in the
// comma-separated columns list. Index definitions always include the indexed
// column names, so this is sufficient to detect the historical single-column
// index that shared the composite index name.
func indexHasColumns(def, columns string) bool {
	lower := strings.ToLower(def)
	for _, column := range strings.Split(columns, ",") {
		if !strings.Contains(lower, strings.ToLower(strings.TrimSpace(column))) {
			return false
		}
	}
	return true
}

// tableExists reports whether a table is present in the database.
func tableExists(database *gorm.DB, table string) bool {
	var count int64
	err := database.Raw(
		"SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?", table,
	).Scan(&count).Error
	if err == nil {
		return count > 0
	}

	// PostgreSQL has no sqlite_master; fall back to the information schema.
	var pgCount int64
	err = database.Raw(
		"SELECT COUNT(*) FROM information_schema.tables WHERE table_name = ? AND table_schema = 'public'",
		table,
	).Scan(&pgCount).Error
	return err == nil && pgCount > 0
}

// reportDuplicateRows prints the rows that already violate a unique index.
//
// The table and column names come from integrityIndexes, which is a package
// level constant — they are never derived from request data.
func reportDuplicateRows(database *gorm.DB, spec uniqueIndexSpec) {
	where := "1 = 1"
	if spec.Predicate != "" {
		where = spec.Predicate
	}

	query := fmt.Sprintf(
		"SELECT %s, COUNT(*) FROM %s WHERE %s GROUP BY %s HAVING COUNT(*) > 1",
		spec.Columns, spec.Table, where, spec.Columns)

	rows, err := database.Raw(query).Rows()
	if err != nil {
		log.Printf("WARNING: could not check %s for duplicate rows: %v", spec.Name, err)
		return
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return
	}

	found := false
	for rows.Next() {
		values := make([]any, len(columns))
		pointers := make([]any, len(columns))
		for i := range values {
			pointers[i] = &values[i]
		}
		if err := rows.Scan(pointers...); err != nil {
			continue
		}

		found = true
		log.Printf("WARNING: %s — duplicate value (%s) appears %v times; the unique index %s cannot be created until these rows are resolved",
			spec.Name, columns[:len(columns)-1], values[len(columns)-1], spec.Name)
	}

	if found {
		log.Printf("WARNING: the invariant enforced by %s is NOT enforced until the duplicates above are resolved.", spec.Name)
	}
}
