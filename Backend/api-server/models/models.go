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
	ID     uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	TreeID string    `gorm:"unique;default:''" json:"tree_id"`

	PlanterID uuid.UUID `json:"planter_id"`
	Planter   User      `gorm:"foreignKey:PlanterID" json:"planter"`

	Species     string  `json:"species"`
	Nickname    string  `json:"nickname"`
	OwnerWallet string  `json:"owner_wallet"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	Location    string  `gorm:"column:location" json:"location"`

	PhotoURL string `gorm:"column:image_url" json:"image_url"`
	// The database column is ip_fs_hash (GORM's snake_case conversion of the
	// field name) while the API exposes it as ipfs_hash. The column tag keeps
	// that mapping explicit so a future field rename cannot silently break the
	// public tree listing query.
	IPFSHash string `gorm:"column:ip_fs_hash" json:"ipfs_hash"`
	// BlockchainTokenID is the on-chain token id of the tree NFT. It must be
	// unique: two trees claiming the same NFT is exactly the double
	// counting the platform exists to prevent. The index is partial so trees
	// that have not been minted yet (empty id) do not collide.
	BlockchainTokenID string `gorm:"uniqueIndex:uni_trees_blockchain_token_id,where:blockchain_token_id IS NOT NULL AND blockchain_token_id <> ''" json:"blockchain_token_id"`
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
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	// TreeID and Type together form the uniqueness key. BOTH fields must carry
	// the same index name: a uniqueIndex tag on only one field creates a
	// single-column index, which would allow just one credit of each type in
	// the entire table.
	TreeID uuid.UUID `gorm:"uniqueIndex:uni_carbon_credits_tree_id_type,where:type <> 'burned'" json:"tree_id"`
	UserID uuid.UUID `json:"user_id"`
	Amount float64   `json:"amount"` // Positive for earned, negative for lost
	// Tradeable is false for credits frozen by an unresolved replantation
	// debt and for burn rows.
	//
	// There is deliberately no gorm default here: with `default:true`, GORM
	// omits the zero value on INSERT and the database writes true, so a credit
	// explicitly created as frozen silently became spendable. Every issuance
	// path sets Tradeable explicitly instead.
	Tradeable bool `json:"tradeable"`
	// TransactionHash identifies the on-chain transaction that produced this
	// entry. The unique index makes a burn idempotent: replaying the same
	// transaction hash is rejected instead of burning the credits twice.
	// The index is partial so entries without a hash do not collide.
	TransactionHash string `gorm:"uniqueIndex:uni_carbon_credits_transaction_hash,where:transaction_hash IS NOT NULL AND transaction_hash <> ''" json:"transaction_hash"`
	// Type is one of: verification_reward, minted, burned, penalty,
	// compensation.
	//
	// The composite unique index on (tree_id, type) is what stops a tree from
	// being credited twice — the integrity invariant the platform is built on.
	// Burns are excluded because they are not attributed to a single tree
	// (they carry the zero tree id) and a user may legitimately burn more than
	// once.
	Type      string    `gorm:"uniqueIndex:uni_carbon_credits_tree_id_type" json:"type"`
	CreatedAt time.Time `json:"created_at"`
}

type Verification struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	TreeID     uuid.UUID `json:"tree_id"`
	VerifierID uuid.UUID `json:"verifier_id"`
	Status     string    `json:"status"`                         // VERIFIED, REJECTED
	Type       string    `gorm:"default:'planting'" json:"type"` // planting, cutting
	Notes      string    `json:"notes"`
	CreatedAt  time.Time `json:"created_at"`
}

// CutReport — submitted by tree owner when a verified tree is physically cut
type CutReport struct {
	ID               uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	TreeID           string    `gorm:"not null;unique" json:"tree_id"`
	OwnerWallet      string    `gorm:"not null" json:"owner_wallet"`
	Reason           string    `gorm:"not null" json:"reason"` // Storm / Construction / Disease / Other
	CutDate          time.Time `json:"cut_date"`
	Description      string    `json:"description"`
	EvidenceImageURL string    `json:"evidence_image_url"`
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
	// TransactionHash is the on-chain confirmCut transaction that created
	// this debt and froze the debtor's credits. Empty for legacy rows.
	TransactionHash string     `json:"transaction_hash"`
	ClearedAt       *time.Time `json:"cleared_at"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`

	ReplacementTrees []ReplacementTree `gorm:"foreignKey:DebtID" json:"replacement_trees"`
}

// ReplacementTree — links a newly planted tree to a replantation debt
type ReplacementTree struct {
	ID     uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	DebtID uuid.UUID `gorm:"not null" json:"debt_id"`
	// TreeID must be unique across the whole table: a single tree may
	// satisfy at most one replantation debt, otherwise a debtor could clear
	// several debts with one replacement tree.
	TreeID   string    `gorm:"not null;uniqueIndex:uni_replacement_trees_tree_id" json:"tree_id"`
	LinkedAt time.Time `json:"linked_at"`
	// TransactionHash is the on-chain markReplanted transaction that linked
	// the tree to the debt. Empty for legacy rows.
	TransactionHash string `json:"transaction_hash"`
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
	ID              uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	CertificateID   string    `gorm:"unique;not null" json:"certificate_id"` // "CERT-2024-001"
	DebtID          uuid.UUID `gorm:"not null" json:"debt_id"`
	IssuedTo        string    `gorm:"not null" json:"issued_to"` // owner wallet
	OriginalTreeID  string    `gorm:"not null" json:"original_tree_id"`
	CO2RestoredKg   float64   `json:"co2_restored_kg"`
	CreditsRestored float64   `json:"credits_restored"`
	IssuedAt        time.Time `json:"issued_at"`
}

type ActivityLog struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	EventType   string     `json:"event_type"` // TREE_PLANTED/TREE_VERIFIED/TREE_CUT/DEBT_CLEARED/CERT_ISSUED
	TreeID      string     `json:"tree_id"`
	DebtID      *uuid.UUID `gorm:"type:uuid" json:"debt_id"`
	Actor       string     `json:"actor"` // wallet address
	Description string     `json:"description"`
	CreatedAt   time.Time  `json:"created_at"`
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
	Status         string    `gorm:"default:'ACTIVE'" json:"status"`                      // ACTIVE/PARTIAL/SOLD/CANCELLED
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
	// TxHash carries the on-chain transaction that settled the purchase. The
	// unique index is what makes marketplace replay protection race-free: the
	// transaction row is inserted first and a duplicate hash is rejected by
	// the database, not by a racy pre-insert COUNT.
	//
	// The index is partial (WHERE tx_hash <> '') so legacy rows that carry no
	// hash do not collide with each other.
	TxHash    string    `gorm:"uniqueIndex:uni_marketplace_transactions_tx_hash,where:tx_hash <> ''" json:"tx_hash"`
	Status    string    `gorm:"default:'CONFIRMED'" json:"status"` // PENDING/CONFIRMED/FAILED
	CreatedAt time.Time `json:"created_at"`
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
