package models

import (
	"time"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	WalletAddress string         `gorm:"unique;not null" json:"wallet_address"`
	Nonce         string         `json:"-"` // Used for signature verification
	FullName      string         `json:"full_name"`
	AvatarURL     string         `json:"avatar_url"`
	Role          string         `gorm:"default:'user'" json:"role"`
	XPPoints      int            `gorm:"default:0" json:"xp_points"`
	Level         int            `gorm:"default:1" json:"level"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

type Tree struct {
	ID                   uuid.UUID `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	PlanterID            uuid.UUID `json:"planter_id"`
	Species              string    `json:"species"`
	Latitude             float64   `json:"latitude"`
	Longitude            float64   `json:"longitude"`
	LocationName         string    `json:"location_name"`
	PhotoURL             string    `json:"photo_url"`
	IPFSHash             string    `json:"ipfs_hash"`
	BlockchainTokenID    string    `json:"blockchain_token_id"`
	Status               string    `gorm:"default:'pending'" json:"status"`
	CarbonAbsorptionRate float64   `json:"carbon_absorption_rate"`
	PlantedAt            time.Time `json:"planted_at"`
	VerifiedAt           *time.Time `json:"verified_at"`
	CreatedAt            time.Time `json:"created_at"`
}

type CarbonCredit struct {
	ID              uuid.UUID `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	UserID          uuid.UUID `json:"user_id"`
	TreeID          uuid.UUID `json:"tree_id"`
	Amount          float64   `json:"amount"`
	TransactionHash string    `json:"transaction_hash"`
	Type            string    `json:"type"`
	CreatedAt       time.Time `json:"created_at"`
}

type Verification struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:uuid_generate_v4()" json:"id"`
	TreeID    uuid.UUID `json:"tree_id"`
	VerifierID uuid.UUID `json:"verifier_id"`
	Status    string    `json:"status"`
	Notes     string    `json:"notes"`
	CreatedAt time.Time `json:"created_at"`
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return
}
