package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID                  uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	WalletAddress       string    `gorm:"unique;not null" json:"wallet_address"`
	Nonce               string    `json:"-"`
	FullName            string    `json:"full_name"`
	AvatarURL           string    `json:"avatar_url"`
	Role                string    `gorm:"default:'user'" json:"role"`
	XPPoints            int       `gorm:"default:0" json:"xp_points"`
	Level               int       `gorm:"default:1" json:"level"`
	SustainabilityScore float64   `gorm:"default:100" json:"sustainability_score"`
	CarbonBalance       float64   `gorm:"default:0" json:"carbon_balance"`
	EnvironmentalDebt   float64   `gorm:"default:0" json:"environmental_debt"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type Tree struct {
	ID    uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	TreeID string   `gorm:"unique;default:''" json:"tree_id"`

	PlanterID uuid.UUID `json:"planter_id"`
	Planter   User      `gorm:"foreignKey:PlanterID" json:"planter"`

	Species     string  `json:"species"`
	Nickname    string  `json:"nickname"`
	OwnerWallet string  `json:"owner_wallet"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	Location    string  `gorm:"column:location" json:"location"`

	PhotoURL          string `gorm:"column:image_url" json:"image_url"`
	IPFSHash          string `json:"ipfs_hash"`
	BlockchainTokenID string `json:"blockchain_token_id"`
	TransactionHash   string `json:"transaction_hash"`
	ContractAddress   string `json:"contract_address"`

	// Status: PENDING_VERIFICATION | VERIFIED | REJECTED | CUT_REPORTED | CUT_CONFIRMED
	Status               string  `gorm:"default:'PENDING_VERIFICATION'" json:"status"`
	HealthStatus         string  `gorm:"default:'Healthy'" json:"health_status"`
	CarbonAbsorptionRate float64 `json:"carbon_absorption_rate"`

	PlantedAt  time.Time  `json:"planted_at"`
	Age        int        `json:"age"`
	VerifiedBy *uuid.UUID `gorm:"type:uuid" json:"verified_by"`
	VerifiedAt *time.Time `json:"verified_at"`

	// Replacement tracking
	IsReplacement   bool       `gorm:"default:false" json:"is_replacement"`
	ReplantedDebtID *uuid.UUID `gorm:"type:uuid" json:"replanted_debt_id"`

	// Credit accounting
	CreditsAvailable float64 `gorm:"default:0" json:"credits_available"`
	CreditsListed    float64 `gorm:"default:0" json:"credits_listed"`
	CreditsSold      float64 `gorm:"default:0" json:"credits_sold"`

	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	Verifications []Verification `gorm:"foreignKey:TreeID" json:"verifications"`
	CutReport     *CutReport     `gorm:"foreignKey:TreeID;references:TreeID" json:"cut_report"`
}

type CarbonCredit struct {
	ID              uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID          uuid.UUID `json:"user_id"`
	TreeID          uuid.UUID `json:"tree_id"`
	Amount          float64   `json:"amount"` // Positive for earned, negative for lost
	Tradeable       bool      `gorm:"default:true" json:"tradeable"`
	TransactionHash string    `json:"transaction_hash"`
	Type            string    `json:"type"` // earned, penalty, compensation
	CreatedAt       time.Time `json:"created_at"`
}

type Verification struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	TreeID     uuid.UUID `json:"tree_id"`
	VerifierID uuid.UUID `json:"verifier_id"`
	Status     string    `json:"status"` // VERIFIED, REJECTED
	Type       string    `gorm:"default:'planting'" json:"type"` // planting, cutting
	Notes      string    `json:"notes"`
	CreatedAt  time.Time `json:"created_at"`
}

// CutReport — submitted by tree owner when a verified tree is physically cut
type CutReport struct {
	ID               uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	TreeID           string     `gorm:"not null;unique" json:"tree_id"`
	Tree             Tree       `gorm:"foreignKey:TreeID;references:TreeID" json:"tree"`
	OwnerWallet      string     `gorm:"not null" json:"owner_wallet"`
	Reason           string     `gorm:"not null" json:"reason"` // Storm / Construction / Disease / Other
	CutDate          time.Time  `json:"cut_date"`
	Description      string     `json:"description"`
	EvidenceImageURL string     `json:"evidence_image_url"`
	// Status: PENDING | CONFIRMED | REJECTED
	Status      string     `gorm:"default:'PENDING'" json:"status"`
	ConfirmedBy string     `json:"confirmed_by"`
	ConfirmedAt *time.Time `json:"confirmed_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

// EnvironmentalLoss — auto-calculated when admin confirms a cut
type EnvironmentalLoss struct {
	ID                     uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	TreeID                 string    `gorm:"not null" json:"tree_id"`
	CutReportID            uuid.UUID `json:"cut_report_id"`
	CO2LostKg              float64   `json:"co2_lost_kg"`
	OxygenLostKg           float64   `json:"oxygen_lost_kg"`
	CreditsLost            float64   `json:"credits_lost"`
	ReplacementTreesNeeded int       `json:"replacement_trees_needed"`
	CalculatedAt           time.Time `json:"calculated_at"`
}

// ReplantationDebt — tracks how many replacement trees must be planted
type ReplantationDebt struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	OriginalTreeID string    `gorm:"not null" json:"original_tree_id"`
	OwnerWallet    string    `gorm:"not null" json:"owner_wallet"`
	TreesNeeded    int       `gorm:"not null" json:"trees_needed"`
	TreesPlanted   int       `gorm:"default:0" json:"trees_planted"`
	TreesVerified  int       `gorm:"default:0" json:"trees_verified"`
	// Status: PENDING | IN_PROGRESS | CLEARED
	Status        string     `gorm:"default:'PENDING'" json:"status"`
	CertificateID string     `json:"certificate_id"`
	ClearedAt     *time.Time `json:"cleared_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`

	ReplacementTrees []ReplacementTree `gorm:"foreignKey:DebtID" json:"replacement_trees"`
}

// ReplacementTree — links a newly planted tree to a replantation debt
type ReplacementTree struct {
	ID       uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	DebtID   uuid.UUID `gorm:"not null" json:"debt_id"`
	TreeID   string    `gorm:"not null" json:"tree_id"`
	LinkedAt time.Time `json:"linked_at"`
}

// CompensationRecord — legacy table, retained for DB compatibility
type CompensationRecord struct {
	ID                uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	CutTreeID         uuid.UUID `json:"cut_tree_id"`
	ReplacementTreeID uuid.UUID `json:"replacement_tree_id"`
	Status            string    `gorm:"default:'pending'" json:"status"`
	CreatedAt         time.Time `json:"created_at"`
}

type RestorationCertificate struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	CertificateID  string    `gorm:"unique;not null" json:"certificate_id"` // "CERT-2024-001"
	DebtID         uuid.UUID `gorm:"not null" json:"debt_id"`
	IssuedTo       string    `gorm:"not null" json:"issued_to"` // owner wallet
	OriginalTreeID string    `gorm:"not null" json:"original_tree_id"`
	CO2RestoredKg  float64   `json:"co2_restored_kg"`
	CreditsRestored float64   `json:"credits_restored"`
	IssuedAt       time.Time `json:"issued_at"`
}

type ActivityLog struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	EventType   string    `json:"event_type"` // TREE_PLANTED/TREE_VERIFIED/TREE_CUT/DEBT_CLEARED/CERT_ISSUED
	TreeID      string    `json:"tree_id"`
	DebtID      *uuid.UUID `gorm:"type:uuid" json:"debt_id"`
	Actor       string    `json:"actor"` // wallet address
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type MarketplaceListing struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	SellerWallet   string    `gorm:"not null" json:"seller_wallet"`
	TreeID         string    `gorm:"not null" json:"tree_id"`
	Tree           Tree      `gorm:"foreignKey:TreeID;references:TreeID" json:"tree"`
	Species        string    `json:"species"`
	CreditsTotal   float64   `gorm:"type:decimal(10,6);not null" json:"credits_total"`
	CreditsSold    float64   `gorm:"type:decimal(10,6);default:0" json:"credits_sold"`
	PricePerCredit float64   `gorm:"type:decimal(10,2);not null" json:"price_per_credit"` // in INR
	Status         string    `gorm:"default:'ACTIVE'" json:"status"`                     // ACTIVE/PARTIAL/SOLD/CANCELLED
	ExpiresAt      time.Time `json:"expires_at"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type MarketplaceTransaction struct {
	ID                uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	ListingID         uuid.UUID `json:"listing_id"`
	BuyerWallet       string    `gorm:"not null" json:"buyer_wallet"`
	SellerWallet      string    `gorm:"not null" json:"seller_wallet"`
	TreeID            string    `gorm:"not null" json:"tree_id"`
	CreditsAmount     float64   `gorm:"type:decimal(10,6);not null" json:"credits_amount"`
	PricePerCreditINR float64   `gorm:"type:decimal(10,2);not null" json:"price_per_credit_inr"`
	TotalINR          float64   `gorm:"type:decimal(12,2);not null" json:"total_inr"`
	PlatformFeeINR    float64   `gorm:"type:decimal(10,2);not null" json:"platform_fee_inr"`
	SellerReceivedINR float64   `gorm:"type:decimal(12,2);not null" json:"seller_received_inr"`
	EthAmount         float64   `gorm:"type:decimal(18,8)" json:"eth_amount"`
	EthRateAtTime     float64   `gorm:"type:decimal(12,2)" json:"eth_rate_at_time"`
	TxHash            string    `json:"tx_hash"`
	Status            string    `gorm:"default:'CONFIRMED'" json:"status"` // PENDING/CONFIRMED/FAILED
	CreatedAt         time.Time `json:"created_at"`
}

type CreditLedger struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Wallet       string    `gorm:"not null;index" json:"wallet"`
	TreeID       string    `json:"tree_id"`
	EventType    string    `json:"event_type"` // EARNED/LISTED/UNLISTED/SOLD/BOUGHT/FROZEN/UNFROZEN
	Amount       float64   `gorm:"type:decimal(10,6);not null" json:"amount"`
	BalanceAfter float64   `gorm:"type:decimal(10,6);not null" json:"balance_after"`
	ReferenceID  string    `json:"reference_id"` // listing_id or transaction_id
	CreatedAt    time.Time `json:"created_at"`
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return
}
