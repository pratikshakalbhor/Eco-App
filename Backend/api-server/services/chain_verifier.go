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

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

// ErrRPCNotConfigured is returned when no RPC_URL is set, meaning on-chain
// verification is impossible in this environment.
var ErrRPCNotConfigured = errors.New("RPC_URL is not configured")

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

// VerifyTxSucceeded confirms that txHash was included in a block and executed
// successfully (receipt status 1). Used to gate off-chain state changes such as
// tree verification on the actual on-chain confirmation.
func VerifyTxSucceeded(txHash string) error {
	rpcURL := os.Getenv("RPC_URL")
	if rpcURL == "" {
		return ErrRPCNotConfigured
	}

	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return fmt.Errorf("connect rpc: %w", err)
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	receipt, err := client.TransactionReceipt(ctx, common.HexToHash(txHash))
	if err != nil {
		return fmt.Errorf("transaction receipt not found: %w", err)
	}
	if receipt.Status != 1 {
		return fmt.Errorf("transaction %s reverted on-chain", txHash)
	}
	return nil
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
