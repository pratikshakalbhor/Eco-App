package config

import (
	"fmt"
	"log"
	"os"
	"github.com/joho/godotenv"
	"ecochain-backend/models"
	"gorm.io/driver/postgres"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
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
	})
	if err != nil {
		log.Println("WARNING: Failed to connect to Postgres database, falling back to local SQLite (ecochain.db):", err)
		database, err = gorm.Open(sqlite.Open("ecochain.db"), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Warn),
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

	// Auto-Migrate Models individually to ensure one failure doesn't block others
	fmt.Println("Running Auto-Migration...")
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

	DB = database
	fmt.Println("Connected to database successfully")
}
