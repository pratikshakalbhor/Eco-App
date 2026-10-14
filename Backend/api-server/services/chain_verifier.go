package services

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"os"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

// ErrRPCNotConfigured is returned when no RPC_URL is set, meaning on-chain
// verification is impossible in this environment.
var ErrRPCNotConfigured = errors.New("RPC_URL is not configured")

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
// transfer of at least minWei to toAddress. It reads state directly from the
// node and never trusts client-supplied amounts.
func VerifyNativePayment(txHash, toAddress string, minWei *big.Int) error {
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
		return fmt.Errorf("payment recipient mismatch: expected %s", toAddress)
	}
	if minWei != nil && tx.Value().Cmp(minWei) < 0 {
		return fmt.Errorf("underpaid: sent %s wei, require at least %s wei", tx.Value(), minWei)
	}

	return nil
}

// EthToWei converts an ETH amount (as float) to wei.
func EthToWei(eth float64) *big.Int {
	if eth <= 0 {
		return big.NewInt(0)
	}
	wei := new(big.Float).Mul(big.NewFloat(eth), big.NewFloat(1e18))
	out, _ := wei.Int(nil)
	return out
}
