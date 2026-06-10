package models

import (
	"time"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	WalletAddress string         `gorm:"unique;not null" json:"wallet_address"`
	Nonce         string         `json:"-"`
	FullName      string         `json:"full_name"`
	AvatarURL     string         `json:"avatar_url"`
	Role          string         `gorm:"default:'user'" json:"role"`
	XPPoints      int            `gorm:"default:0" json:"xp_points"`
	Level         int            `gorm:"default:1" json:"level"`
	SustainabilityScore float64  `gorm:"default:100" json:"sustainability_score"`
	CarbonBalance       float64  `gorm:"default:0" json:"carbon_balance"`
	EnvironmentalDebt   float64  `gorm:"default:0" json:"environmental_debt"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

type Tree struct {
	ID                   uuid.UUID  `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	TreeID               string    `gorm:"unique;not null" json:"tree_id"`
	PlanterID            uuid.UUID  `json:"planter_id"`
	Planter              User       `gorm:"foreignKey:PlanterID" json:"planter"`
	Species              string     `json:"species"`
	Nickname             string     `json:"nickname"`
	OwnerWallet          string     `json:"owner_wallet"`
	Latitude             float64    `json:"latitude"`
	Longitude            float64    `json:"longitude"`
	Location             string     `gorm:"column:location" json:"location"`
	PhotoURL             string    `gorm:"column:image_url" json:"image_url"`
	IPFSHash             string    `json:"ipfs_hash"`
	BlockchainTokenID    string    `json:"blockchain_token_id"`
	TransactionHash      string    `json:"transaction_hash"`
	Status               string    `gorm:"default:'pending'" json:"status"` // pending_verification, verified, rejected
	HealthStatus         string    `gorm:"default:'excellent'" json:"health_status"`
	CarbonAbsorptionRate float64   `json:"carbon_absorption_rate"`
	PlantedAt            time.Time `json:"planted_at"`
	Age                  int       `json:"age"`
	VerifiedBy           *uuid.UUID `gorm:"type:uuid" json:"verified_by"`
	VerifiedAt           *time.Time `json:"verified_at"`
	IsCut                bool      `gorm:"default:false" json:"is_cut"`
	CutAt                *time.Time `json:"cut_at"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
	TreeCutReport         *TreeCutReport `gorm:"foreignKey:TreeID" json:"tree_cut_report"`
	Verifications         []Verification `gorm:"foreignKey:TreeID" json:"verifications"`
}

type CarbonCredit struct {
	ID              uuid.UUID `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	UserID          uuid.UUID `json:"user_id"`
	TreeID          uuid.UUID `json:"tree_id"`
	Amount          float64   `json:"amount"` // Positive for earned, negative for lost
	TransactionHash string    `json:"transaction_hash"`
	Type            string    `json:"type"` // earned, penalty, compensation
	CreatedAt       time.Time `json:"created_at"`
}

type Verification struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	TreeID    uuid.UUID `json:"tree_id"`
	VerifierID uuid.UUID `json:"verifier_id"`
	Status    string    `json:"status"` // approved, rejected, more_evidence
	Type      string    `gorm:"default:'planting'" json:"type"` // planting, cutting, compensation
	Notes     string    `json:"notes"`
	CreatedAt time.Time `json:"created_at"`
}

type TreeCutReport struct {
	ID                uuid.UUID `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	TreeID            uuid.UUID `json:"tree_id"`
	ReporterID        uuid.UUID `json:"reporter_id"`
	Reason            string    `json:"reason"`
	EvidenceURL       string    `json:"evidence_url"`
	Status            string    `gorm:"default:'pending'" json:"status"` // pending, verified, rejected
	LossAmount        float64   `json:"loss_amount"` // Carbon loss in kg
	OxygenLoss        float64   `json:"oxygen_loss"` // Estimated O2 loss
	CompensationRatio int       `gorm:"default:3" json:"compensation_ratio"` // e.g. 3 for 3:1
	RequiredTrees     int       `json:"required_trees"`
	CreatedAt         time.Time `json:"created_at"`
}

type CompensationRecord struct {
	ID                uuid.UUID `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	CutTreeID         uuid.UUID `json:"cut_tree_id"`
	ReplacementTreeID uuid.UUID `json:"replacement_tree_id"`
	Status            string    `gorm:"default:'pending'" json:"status"`
	CreatedAt         time.Time `json:"created_at"`
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return
}
