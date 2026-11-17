package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"math/big"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// ErrRPCNotConfigured is returned when no RPC_URL is set, meaning on-chain
// verification is impossible in this environment.
var ErrRPCNotConfigured = errors.New("RPC_URL is not configured")

// EcoChainTreeABI is the ABI fragment for the events EcoChainTree emits that
// the backend decodes to verify on-chain state changes. Loading the full ABI
// from the build artifacts is an alternative; this fragment is deterministic
// and avoids a filesystem dependency at runtime.
var EcoChainTreeABI = mustLoadABI(`[
	{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":true,"internalType":"address","name":"planter","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"CreditsMinted","type":"event"},
	{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":true,"internalType":"address","name":"verifier","type":"address"}],"name":"TreeCutConfirmed","type":"event"},
	{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":true,"internalType":"uint256","name":"originalTokenId","type":"uint256"}],"name":"TreeReplanted","type":"event"}
]`)

// txHashPattern matches a 32-byte hex transaction hash.
var txHashPattern = regexp.MustCompile(`^0x[0-9a-fA-F]{64}$`)

// PaymentVerificationFunc validates that an on-chain transaction settles a
// marketplace purchase.
//
//	txHash      the transaction to inspect
//	toAddress   the address that must have received the funds
//	fromAddress the address that must have sent the funds (the buyer)
//	minWei      the minimum amount that must have been transferred
type PaymentVerificationFunc func(txHash, toAddress, fromAddress string, minWei *big.Int) error

// PaymentVerifier is the seam the marketplace controller uses to validate
// payments. It is a package-level variable so that tests can substitute a
// deterministic stub instead of reaching a live RPC node.
//
// Production code must never replace it.
var PaymentVerifier PaymentVerificationFunc = VerifyNativePayment

// mustLoadABI parses the ABI JSON at init time so a malformed ABI fails fast
// instead of at the first verification request.
func mustLoadABI(abiJSON string) abi.ABI {
	parsed, err := abi.JSON(strings.NewReader(abiJSON))
	if err != nil {
		panic(fmt.Errorf("invalid EcoChainTree ABI: %w", err))
	}
	return parsed
}

// receiptFetcher is the seam the event decoders use to obtain a receipt.
// Production code never replaces it; tests substitute a deterministic stub so
// the decoding rules can be exercised without a live RPC node.
var receiptFetcher = fetchReceipt

// CreditsMintedDecoder, CutSettlementDecoder and ReplantationDecoder are the
// seams the controllers use. They default to the real receipt decoders and
// exist so HTTP-level tests can exercise the validation and replay rules
// without a live chain. Production code must never replace them.
var (
	CreditsMintedDecoder = DecodeCreditsMinted
	CutSettlementDecoder = DecodeCutSettlement
	ReplantationDecoder  = DecodeTreeReplanted
	CreditBurnDecoder    = DecodeCreditBurn
)

// CreditsMintedEvent is the decoded CreditsMinted log from EcoChainTree.
type CreditsMintedEvent struct {
	TokenId *big.Int
	Planter common.Address
	Amount  *big.Int
}

// TreeCutConfirmedEvent is the decoded TreeCutConfirmed log from EcoChainTree.
type TreeCutConfirmedEvent struct {
	TokenId  *big.Int
	Verifier common.Address
}

// DebtCreatedEvent is the decoded DebtCreated log from ReplantationRegistry.
type DebtCreatedEvent struct {
	DebtId             *big.Int
	OriginalTokenId    *big.Int
	Debtor             common.Address
	ReplacementsNeeded uint16
}

// TreeReplantedEvent is the decoded TreeReplanted log from EcoChainTree.
type TreeReplantedEvent struct {
	ReplacementTokenId *big.Int
	OriginalTokenId    *big.Int
}

// erc20TransferTopic is topic0 of the ERC-20 Transfer event. A burn is encoded
// by OpenZeppelin as Transfer(from, address(0), amount).
var erc20TransferTopic = crypto.Keccak256Hash([]byte("Transfer(address,address,uint256)"))

// CreditBurn is the decoded on-chain evidence that a wallet retired credits.
type CreditBurn struct {
	// Token is the contract that emitted the event.
	Token common.Address
	// From is the wallet whose balance was reduced.
	From common.Address
	// Amount is the burned amount in 18-decimal token units.
	Amount *big.Int
}


// CutSettlement is the full on-chain evidence of a confirmed cut: the
// TreeCutConfirmed event plus the replantation-debt creation and the freeze
// of the planter's credits. A cut confirmation is only accepted when all
// three are present in the same successful transaction.
type CutSettlement struct {
	Confirmed TreeCutConfirmedEvent
	Debt      DebtCreatedEvent
	Frozen    bool
	// FrozenAccount is the account whose credits the transaction froze; it
	// must be the tree's planter.
	FrozenAccount common.Address
}

// eventTopic returns the keccak256 topic hash for a given event name.
func eventTopic(eventName string) common.Hash {
	return crypto.Keccak256Hash([]byte(eventName))
}

// topicAt returns the topic at index i, or a zero hash when it is missing.
func topicAt(log *types.Log, i int) common.Hash {
	if len(log.Topics) <= i {
		return common.Hash{}
	}
	return log.Topics[i]
}

// topicBigInt interprets an indexed uint256 topic. Indexed values are stored
// left-padded to 32 bytes, so the bytes are read as a big-endian integer.
func topicBigInt(log *types.Log, i int) (*big.Int, error) {
	if len(log.Topics) <= i {
		return nil, fmt.Errorf("event has %d topics, need at least %d", len(log.Topics), i+1)
	}
	return new(big.Int).SetBytes(log.Topics[i].Bytes()), nil
}

// topicAddress interprets an indexed address topic.
func topicAddress(log *types.Log, i int) (common.Address, error) {
	if len(log.Topics) <= i {
		return common.Address{}, fmt.Errorf("event has %d topics, need at least %d", len(log.Topics), i+1)
	}
	return common.BytesToAddress(log.Topics[i].Bytes()), nil
}

// findEventLog returns the first log in the receipt whose topic[0] matches the
// given event topic, scanning only logs emitted by the EcoChainTree contract
// when an address is configured.
func findEventLog(receipt *types.Receipt, eventTopic common.Hash, ecoChainTree common.Address) (*types.Log, bool) {
	for _, log := range receipt.Logs {
		if len(log.Topics) == 0 {
			continue
		}
		if log.Topics[0] != eventTopic {
			continue
		}
		if ecoChainTree != (common.Address{}) && log.Address != ecoChainTree {
			continue
		}
		return log, true
	}
	return nil, false
}

// DecodeCreditsMinted fetches the receipt for txHash and decodes the
// CreditsMinted(uint256 indexed tokenId, address indexed planter, uint256 amount)
// event emitted by EcoChainTree.
//
// The returned amount is the on-chain credit amount in wei-scaled units
// (1 token = 1e18 wei = 1 credit = 1000 kg CO2e). The backend stores this
// amount — never a client-supplied value — as the chain-confirmed credit
// issuance for the tree.
func DecodeCreditsMinted(txHash string) (*CreditsMintedEvent, error) {
	receipt, err := receiptFetcher(txHash)
	if err != nil {
		return nil, err
	}
	return decodeCreditsMintedFromReceipt(receipt, ecoChainTreeAddress())
}

// decodeCreditsMintedFromReceipt is the pure decoding step, split out so tests
// can supply a synthetic receipt.
func decodeCreditsMintedFromReceipt(receipt *types.Receipt, contract common.Address) (*CreditsMintedEvent, error) {
	log, ok := findEventLog(receipt, EcoChainTreeABI.Events["CreditsMinted"].ID, contract)
	if !ok {
		return nil, fmt.Errorf("CreditsMinted event not found in transaction")
	}

	tokenId, err := topicBigInt(log, 1)
	if err != nil {
		return nil, fmt.Errorf("CreditsMinted tokenId: %w", err)
	}
	planter, err := topicAddress(log, 2)
	if err != nil {
		return nil, fmt.Errorf("CreditsMinted planter: %w", err)
	}

	// amount is the only non-indexed argument: a single 32-byte word.
	if len(log.Data) != 32 {
		return nil, fmt.Errorf("CreditsMinted amount has unexpected length: %d bytes", len(log.Data))
	}
	amount := new(big.Int).SetBytes(log.Data)

	return &CreditsMintedEvent{TokenId: tokenId, Planter: planter, Amount: amount}, nil
}

// DecodeTreeCutConfirmed fetches the receipt for txHash and decodes the
// TreeCutConfirmed(uint256 indexed tokenId, address indexed verifier) event.
func DecodeTreeCutConfirmed(txHash string) (*TreeCutConfirmedEvent, error) {
	receipt, err := receiptFetcher(txHash)
	if err != nil {
		return nil, err
	}
	return decodeTreeCutConfirmedFromReceipt(receipt, ecoChainTreeAddress())
}

func decodeTreeCutConfirmedFromReceipt(receipt *types.Receipt, contract common.Address) (*TreeCutConfirmedEvent, error) {
	log, ok := findEventLog(receipt, EcoChainTreeABI.Events["TreeCutConfirmed"].ID, contract)
	if !ok {
		return nil, fmt.Errorf("TreeCutConfirmed event not found in transaction")
	}

	tokenId, err := topicBigInt(log, 1)
	if err != nil {
		return nil, fmt.Errorf("TreeCutConfirmed tokenId: %w", err)
	}
	verifier, err := topicAddress(log, 2)
	if err != nil {
		return nil, fmt.Errorf("TreeCutConfirmed verifier: %w", err)
	}

	return &TreeCutConfirmedEvent{TokenId: tokenId, Verifier: verifier}, nil
}

// DecodeCutSettlement fetches the receipt for txHash and requires every
// on-chain effect of a confirmed cut:
//
//   - TreeCutConfirmed emitted by EcoChainTree;
//   - DebtCreated emitted in the same transaction for the same original tree;
//   - Frozen emitted in the same transaction for the debt's debtor.
//
// A cut confirmation backed only by the off-chain database is exactly the
// double-counting hole this closes.
func DecodeCutSettlement(txHash string) (*CutSettlement, error) {
	receipt, err := receiptFetcher(txHash)
	if err != nil {
		return nil, err
	}
	return decodeCutSettlementFromReceipt(receipt, ecoChainTreeAddress())
}

func decodeCutSettlementFromReceipt(receipt *types.Receipt, contract common.Address) (*CutSettlement, error) {
	confirmed, err := decodeTreeCutConfirmedFromReceipt(receipt, contract)
	if err != nil {
		return nil, err
	}

	debtLog, ok := findEventLog(receipt, debtCreatedTopic(), common.Address{})
	if !ok {
		return nil, fmt.Errorf("DebtCreated event not found in transaction: the cut was not backed by an on-chain replantation debt")
	}
	debtId, err := topicBigInt(debtLog, 1)
	if err != nil {
		return nil, fmt.Errorf("DebtCreated debtId: %w", err)
	}
	originalTokenId, err := topicBigInt(debtLog, 2)
	if err != nil {
		return nil, fmt.Errorf("DebtCreated originalTokenId: %w", err)
	}
	if len(debtLog.Data) < 64 {
		return nil, fmt.Errorf("DebtCreated data has unexpected length: %d bytes", len(debtLog.Data))
	}
	debtor := common.BytesToAddress(debtLog.Data[:32])
	replacements := uint16(new(big.Int).SetBytes(debtLog.Data[32:64]).Uint64())

	if originalTokenId.Cmp(confirmed.TokenId) != 0 {
		return nil, fmt.Errorf("DebtCreated is for tree %s but TreeCutConfirmed is for tree %s", originalTokenId, confirmed.TokenId)
	}

	frozenLog, ok := findEventLog(receipt, frozenTopic(), common.Address{})
	if !ok {
		return nil, fmt.Errorf("Frozen event not found in transaction: the planter's credits were not frozen")
	}
	frozenAccount, err := topicAddress(frozenLog, 1)
	if err != nil {
		return nil, fmt.Errorf("Frozen account: %w", err)
	}
	if frozenAccount != debtor {
		return nil, fmt.Errorf("Frozen account %s does not match the debt debtor %s", frozenAccount, debtor)
	}

	return &CutSettlement{
		Confirmed:     *confirmed,
		Debt:          DebtCreatedEvent{DebtId: debtId, OriginalTokenId: originalTokenId, Debtor: debtor, ReplacementsNeeded: replacements},
		Frozen:        true,
		FrozenAccount: frozenAccount,
	}, nil
}

// DecodeTreeReplanted fetches the receipt for txHash and decodes the
// TreeReplanted(uint256 indexed tokenId, uint256 indexed originalTokenId)
// event emitted by EcoChainTree.
func DecodeTreeReplanted(txHash string) (*TreeReplantedEvent, error) {
	receipt, err := receiptFetcher(txHash)
	if err != nil {
		return nil, err
	}
	return decodeTreeReplantedFromReceipt(receipt, ecoChainTreeAddress())
}

func decodeTreeReplantedFromReceipt(receipt *types.Receipt, contract common.Address) (*TreeReplantedEvent, error) {
	log, ok := findEventLog(receipt, EcoChainTreeABI.Events["TreeReplanted"].ID, contract)
	if !ok {
		return nil, fmt.Errorf("TreeReplanted event not found in transaction")
	}

	replacementTokenId, err := topicBigInt(log, 1)
	if err != nil {
		return nil, fmt.Errorf("TreeReplanted replacementTokenId: %w", err)
	}
	originalTokenId, err := topicBigInt(log, 2)
	if err != nil {
		return nil, fmt.Errorf("TreeReplanted originalTokenId: %w", err)
	}

	return &TreeReplantedEvent{ReplacementTokenId: replacementTokenId, OriginalTokenId: originalTokenId}, nil
}

// DecodeCreditBurn fetches the receipt for txHash and decodes the ERC-20 burn
// (Transfer to the zero address) emitted by the configured EcoToken contract.
//
// Requiring this event is what turns "burn my credits" into a verifiable
// on-chain retirement instead of a database row with an unchecked tx hash.
func DecodeCreditBurn(txHash string) (*CreditBurn, error) {
	receipt, err := receiptFetcher(txHash)
	if err != nil {
		return nil, err
	}
	token, err := ecoTokenAddress()
	if err != nil {
		return nil, err
	}
	return decodeCreditBurnFromReceipt(receipt, token)
}

func decodeCreditBurnFromReceipt(receipt *types.Receipt, token common.Address) (*CreditBurn, error) {
	if token == (common.Address{}) {
		return nil, errors.New("ECO_TOKEN is not configured; cannot verify a credit burn")
	}

	for _, log := range receipt.Logs {
		if log.Address != token || len(log.Topics) != 3 || log.Topics[0] != erc20TransferTopic {
			continue
		}
		// topics: [Transfer, from, to]
		if common.BytesToAddress(log.Topics[2].Bytes()) != (common.Address{}) {
			continue // a normal transfer, not a burn
		}
		if len(log.Data) != 32 {
			return nil, fmt.Errorf("burn Transfer amount has unexpected length: %d bytes", len(log.Data))
		}
		from := common.BytesToAddress(log.Topics[1].Bytes())
		amount := new(big.Int).SetBytes(log.Data)
		if from == (common.Address{}) {
			return nil, errors.New("burn Transfer has a zero sender")
		}
		return &CreditBurn{Token: log.Address, From: from, Amount: amount}, nil
	}

	return nil, fmt.Errorf("no EcoToken burn (Transfer to the zero address) found in transaction")
}

// ValidateCreditBurn checks that a decoded burn was performed by the wallet
// that is claiming the retirement, for exactly the amount being recorded.
//
// The amount check is exact: accepting "at least" the claimed amount would let
// a user burn 1 wei and retire an arbitrary number of ledger credits.
func ValidateCreditBurn(burn *CreditBurn, wallet string, amountCredits float64) error {
	if burn == nil {
		return errors.New("missing credit burn")
	}
	if burn.Amount == nil || burn.Amount.Sign() <= 0 {
		return errors.New("burn amount must be positive")
	}
	if wallet == "" || !strings.EqualFold(burn.From.Hex(), wallet) {
		return fmt.Errorf("burn was performed by %s, not the authenticated wallet %q", burn.From.Hex(), wallet)
	}
	expected := CreditsToWei(amountCredits)
	if expected.Sign() <= 0 {
		return fmt.Errorf("invalid requested burn amount %v", amountCredits)
	}
	if burn.Amount.Cmp(expected) != 0 {
		return fmt.Errorf("transaction burned %s wei but the request retires %s wei", burn.Amount, expected)
	}
	return nil
}

// CreditsToWei converts a credit amount to the 18-decimal integer EcoToken
// uses. Credits and ETH are both 18-decimal fixed point, so this is the same
// exact decimal-string conversion as EthToWei.
func CreditsToWei(credits float64) *big.Int {
	return EthToWei(credits)
}

// debtCreatedTopic is the topic of ReplantationRegistry's
// DebtCreated(uint256 indexed debtId, uint256 indexed originalTokenId,
//             address debtor, uint16 replacementsNeeded).
func debtCreatedTopic() common.Hash {
	return eventTopic("DebtCreated(uint256,uint256,address,uint16)")
}

// frozenTopic is the topic of EcoToken's Frozen(address indexed account).
func frozenTopic() common.Hash {
	return eventTopic("Frozen(address)")
}

// parseTokenID parses a decimal token id from the database. An empty or
// non-numeric id can never match a chain event.
func parseTokenID(raw string) (*big.Int, bool) {
	id, ok := new(big.Int).SetString(strings.TrimSpace(raw), 10)
	if !ok || id.Sign() < 0 {
		return nil, false
	}
	return id, true
}

// ValidateCreditsMinted checks that a decoded CreditsMinted event belongs to
// the given tree token id and was minted to the tree owner. This is the
// server-side guard against crediting a receipt issued for another tree.
func ValidateCreditsMinted(event *CreditsMintedEvent, tokenID, ownerWallet string) error {
	if event == nil {
		return errors.New("missing CreditsMinted event")
	}
	if event.Amount == nil || event.Amount.Sign() <= 0 {
		return errors.New("CreditsMinted event has a non-positive amount")
	}
	want, ok := parseTokenID(tokenID)
	if !ok || want.Cmp(event.TokenId) != 0 {
		return fmt.Errorf("verification transaction is for token %s, not this tree's token %q", event.TokenId, tokenID)
	}
	if ownerWallet == "" || !strings.EqualFold(event.Planter.Hex(), ownerWallet) {
		return fmt.Errorf("verification transaction minted to %s, not this tree's owner %q", event.Planter.Hex(), ownerWallet)
	}
	return nil
}

// ValidateCutSettlement checks that the decoded cut evidence belongs to the
// given tree token id and owner: the confirmed cut, the debt and the freeze
// must all describe the same tree and wallet.
func ValidateCutSettlement(settlement *CutSettlement, tokenID, ownerWallet string) error {
	if settlement == nil {
		return errors.New("missing cut settlement")
	}
	want, ok := parseTokenID(tokenID)
	if !ok || want.Cmp(settlement.Confirmed.TokenId) != 0 {
		return fmt.Errorf("cut confirmation is for token %s, not this tree's token %q", settlement.Confirmed.TokenId, tokenID)
	}
	if settlement.Confirmed.TokenId.Cmp(settlement.Debt.OriginalTokenId) != 0 {
		return fmt.Errorf("on-chain debt is for tree %s but the cut is for tree %s", settlement.Debt.OriginalTokenId, settlement.Confirmed.TokenId)
	}
	if ownerWallet == "" || !strings.EqualFold(settlement.Debt.Debtor.Hex(), ownerWallet) {
		return fmt.Errorf("on-chain debt was created for %s, not this tree's owner %q", settlement.Debt.Debtor.Hex(), ownerWallet)
	}
	if !settlement.Frozen {
		return errors.New("the planter's credits were not frozen on-chain")
	}
	if !strings.EqualFold(settlement.FrozenAccount.Hex(), ownerWallet) {
		return fmt.Errorf("on-chain freeze was applied to %s, not this tree's owner %q", settlement.FrozenAccount.Hex(), ownerWallet)
	}
	return nil
}

// ValidateReplantation checks that a decoded TreeReplanted event links the
// expected replacement tree to the expected original tree.
func ValidateReplantation(event *TreeReplantedEvent, replacementTokenID, originalTokenID string) error {
	if event == nil {
		return errors.New("missing TreeReplanted event")
	}
	wantReplacement, ok := parseTokenID(replacementTokenID)
	if !ok || wantReplacement.Cmp(event.ReplacementTokenId) != 0 {
		return fmt.Errorf("replantation transaction is for replacement token %s, not %q", event.ReplacementTokenId, replacementTokenID)
	}
	wantOriginal, ok := parseTokenID(originalTokenID)
	if !ok || wantOriginal.Cmp(event.OriginalTokenId) != 0 {
		return fmt.Errorf("replantation transaction is for original token %s, not %q", event.OriginalTokenId, originalTokenID)
	}
	return nil
}

// fetchReceipt confirms txHash was included in a block and executed
// successfully (receipt status 1).
func fetchReceipt(txHash string) (*types.Receipt, error) {
	rpcURL := os.Getenv("RPC_URL")
	if rpcURL == "" {
		return nil, ErrRPCNotConfigured
	}

	if !txHashPattern.MatchString(txHash) {
		return nil, fmt.Errorf("malformed transaction hash %q", txHash)
	}

	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, fmt.Errorf("connect rpc: %w", err)
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	receipt, err := client.TransactionReceipt(ctx, common.HexToHash(txHash))
	if err != nil {
		return nil, fmt.Errorf("transaction receipt not found: %w", err)
	}
	if receipt.Status != 1 {
		return nil, fmt.Errorf("transaction %s reverted on-chain", txHash)
	}
	return receipt, nil
}

// ecoChainTreeAddress returns the configured EcoChainTree contract address,
// or the zero address when not configured.
func ecoChainTreeAddress() common.Address {
	addr := os.Getenv("ECO_CHAIN_TREE")
	if addr == "" {
		return common.Address{}
	}
	return common.HexToAddress(addr)
}

// ecoTokenAddress returns the configured EcoToken contract address. It is an
// error (not a zero-address wildcard) when unset: a burn is only meaningful
// when it happened on the token the platform issues.
func ecoTokenAddress() (common.Address, error) {
	addr := strings.TrimSpace(os.Getenv("ECO_TOKEN"))
	if addr == "" {
		return common.Address{}, errors.New("ECO_TOKEN is not configured")
	}
	if !common.IsHexAddress(addr) {
		return common.Address{}, fmt.Errorf("ECO_TOKEN %q is not a valid address", addr)
	}
	return common.HexToAddress(addr), nil
}

// VerifyTxSucceeded confirms that txHash was included in a block and executed
// successfully (receipt status 1). Used to gate off-chain state changes such as
// tree verification on the actual on-chain confirmation.
func VerifyTxSucceeded(txHash string) error {
	_, err := fetchReceipt(txHash)
	return err
}

// VerifyNativePayment confirms that txHash is a successful on-chain native ETH
// transfer of at least minWei, sent by fromAddress and received by toAddress.
//
// Both the sender and the recipient are checked: without the sender check a
// third party could pay on the buyer's behalf (or, worse, a buyer could point
// at somebody else's payment receipt) and still be credited the purchase.
//
// The minimum amount is supplied by the caller and must be derived from a
// server-side price — never from a value supplied by the client.
func VerifyNativePayment(txHash, toAddress, fromAddress string, minWei *big.Int) error {
	rpcURL := os.Getenv("RPC_URL")
	if rpcURL == "" {
		return ErrRPCNotConfigured
	}

	if !txHashPattern.MatchString(txHash) {
		return fmt.Errorf("malformed transaction hash %q", txHash)
	}
	if toAddress == "" {
		return fmt.Errorf("expected payment recipient is empty")
	}
	if fromAddress == "" {
		return fmt.Errorf("expected payment sender is empty")
	}

	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return fmt.Errorf("connect rpc: %w", err)
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	hash := common.HexToHash(txHash)

	receipt, err := client.TransactionReceipt(ctx, hash)
	if err != nil {
		return fmt.Errorf("transaction receipt not found: %w", err)
	}
	if receipt.Status != 1 {
		return fmt.Errorf("transaction %s reverted on-chain", txHash)
	}

	tx, _, err := client.TransactionByHash(ctx, hash)
	if err != nil {
		return fmt.Errorf("transaction lookup failed: %w", err)
	}
	if tx.To() == nil {
		return fmt.Errorf("transaction %s has no recipient", txHash)
	}
	if !strings.EqualFold(tx.To().Hex(), toAddress) {
		return fmt.Errorf("payment recipient mismatch: expected %s, got %s", toAddress, tx.To().Hex())
	}

	// Recover the sender. types.Transaction does not expose From() directly,
	// so the signature is recovered with the signer for the transaction's
	// chain ID (EIP-155 aware).
	signer := types.LatestSignerForChainID(tx.ChainId())
	sender, err := types.Sender(signer, tx)
	if err != nil {
		return fmt.Errorf("could not recover the payment sender: %w", err)
	}
	if !strings.EqualFold(sender.Hex(), fromAddress) {
		return fmt.Errorf("payment sender mismatch: expected %s, got %s", fromAddress, sender.Hex())
	}
	if minWei != nil && tx.Value().Cmp(minWei) < 0 {
		return fmt.Errorf("underpaid: sent %s wei, require at least %s wei", tx.Value(), minWei)
	}

	return nil
}

// EthToWei converts a decimal ETH amount to wei using exact decimal-string
// arithmetic.
//
// The previous implementation multiplied a float64 by 1e18, which silently
// loses precision once the result exceeds 2^53 wei (0.009 ETH) — precisely
// where real marketplace payments live. The float is therefore rendered to its
// shortest decimal representation and parsed digit by digit.
func EthToWei(eth float64) *big.Int {
	if math.IsNaN(eth) || math.IsInf(eth, 0) || eth <= 0 {
		return big.NewInt(0)
	}

	s := strconv.FormatFloat(eth, 'f', -1, 64)
	whole, frac, _ := strings.Cut(s, ".")

	wholeInt, ok := new(big.Int).SetString(whole, 10)
	if !ok {
		return big.NewInt(0)
	}

	// Pad or truncate the fractional part to exactly 18 decimal places.
	if len(frac) > 18 {
		frac = frac[:18]
	}
	frac += strings.Repeat("0", 18-len(frac))

	fracInt, ok := new(big.Int).SetString(frac, 10)
	if !ok {
		return big.NewInt(0)
	}

	wei := wholeInt.Mul(wholeInt, big.NewInt(1_000_000_000_000_000_000))
	return wei.Add(wei, fracInt)
}

// WeiToFloat converts a wei-denominated *big.Int to a float64 credit amount.
// 1 credit = 1e18 wei = 1000 kg CO2e.
func WeiToFloat(wei *big.Int) float64 {
	if wei == nil || wei.Sign() <= 0 {
		return 0
	}
	f := new(big.Float).SetInt(wei)
	f.Quo(f, big.NewFloat(1e18))
	out, _ := f.Float64()
	return out
}
