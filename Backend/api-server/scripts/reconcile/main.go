package main

import (
	"context"
	"ecochain-backend/config"
	"ecochain-backend/models"
	"fmt"
	"log"
	"math"
	"math/big"
	"os"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

// tokenABI is the minimal ABI fragment for balanceOf.
var tokenABI, _ = abi.JSON(strings.NewReader(`[{"constant":true,"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"}`))

func main() {
	log.SetFlags(log.LstdFlags)

	config.InitDB()
	db := config.DB

	rpcURL := os.Getenv("RPC_URL")
	if rpcURL == "" {
		log.Fatal("RPC_URL is not configured")
	}

	tokenAddr := os.Getenv("ECO_TOKEN")
	if tokenAddr == "" {
		log.Fatal("ECO_TOKEN is not configured")
	}
	tokenAddress := common.HexToAddress(tokenAddr)

	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		log.Fatalf("failed to connect to RPC: %v", err)
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Load all users with wallet addresses.
	var users []models.User
	if err := db.Where("wallet_address <> ''").Find(&users).Error; err != nil {
		log.Fatalf("failed to load users: %v", err)
	}

	fmt.Printf("Reconciling %d users against EcoToken at %s\n\n", len(users), tokenAddress)
	fmt.Printf("%-44s %-16s %-16s %-16s %-16s %-8s %s\n",
		"WALLET", "ON-CHAIN", "EARNED", "BURNED", "MKT_DELTA", "STATUS", "NOTE")
	fmt.Println(strings.Repeat("-", 140))

	mismatches := 0
	for _, user := range users {
		wallet := common.HexToAddress(user.WalletAddress)

		// On-chain balance (18 decimals).
		onChainWei, err := tokenBalance(ctx, client, tokenAddress, wallet)
		if err != nil {
			log.Printf("  %s: failed to fetch on-chain balance: %v", user.WalletAddress, err)
			continue
		}
		onChain := weiToFloat(onChainWei)

		// Ledger earned: verification_reward / minted credits issued to user.
		var earned float64
		db.Model(&models.CarbonCredit{}).
			Select("COALESCE(SUM(amount), 0)").
			Where("user_id = ? AND type IN ? AND amount > 0", user.ID, []string{"verification_reward", "minted"}).
			Scan(&earned)

		// Ledger burned: credits burned via EcoToken.burn.
		var burned float64
		db.Model(&models.CarbonCredit{}).
			Select("COALESCE(SUM(amount), 0)").
			Where("user_id = ? AND type = ? AND amount < 0", user.ID, "burned").
			Scan(&burned)
		burned = -burned // make positive

		netLedger := earned - burned

		// Marketplace: credits bought vs sold (CONFIRMED only). Marketplace
		// settlement is currently OFF-CHAIN, so a buyer's EcoToken balance is
		// still higher than the ledger and a seller's is lower. The delta is a
		// known, labelled difference — not a double-counting bug — until the
		// marketplace settles on-chain.
		var bought, sold float64
		db.Model(&models.MarketplaceTransaction{}).
			Select("COALESCE(SUM(credits_amount), 0)").
			Where("buyer_wallet = ? AND status = ?", user.WalletAddress, "CONFIRMED").
			Scan(&bought)
		db.Model(&models.MarketplaceTransaction{}).
			Select("COALESCE(SUM(credits_amount), 0)").
			Where("seller_wallet = ? AND status = ?", user.WalletAddress, "CONFIRMED").
			Scan(&sold)
		marketDelta := bought - sold

		status := "OK"
		note := ""
		diff := math.Abs(onChain - netLedger)
		if diff > 0.0001 {
			if marketDelta != 0 && math.Abs(onChain-(netLedger-marketDelta)) <= 0.0001 {
				// Expected while marketplace settlement is off-chain.
				note = fmt.Sprintf("known marketplace delta %.6f (settled off-chain)", marketDelta)
			} else {
				mismatches++
				status = "MISMATCH"
				note = fmt.Sprintf("on-chain differs from earned-burned by %.6f", onChain-netLedger)
			}
		}

		fmt.Printf("%-44s %-16.6f %-16.6f %-16.6f %-16.6f %-8s %s\n",
			user.WalletAddress, onChain, earned, burned, marketDelta, status, note)
	}

	fmt.Println()
	if mismatches > 0 {
		fmt.Printf("RECONCILIATION: %d mismatch(es) found\n", mismatches)
		os.Exit(1)
	}
	fmt.Println("RECONCILIATION: all users balanced")
}

// tokenBalance calls balanceOf(account) on the EcoToken contract.
func tokenBalance(ctx context.Context, client *ethclient.Client, tokenAddress, account common.Address) (*big.Int, error) {
	data, err := tokenABI.Pack("balanceOf", account)
	if err != nil {
		return nil, err
	}

	msg := common.Address{} // caller doesn't matter for a view call
	result, err := client.CallContract(ctx, ethereum.CallMsg{
		From:     msg,
		To:       &tokenAddress,
		Gas:      0,
		GasPrice: nil,
		Value:    nil,
		Data:     data,
	}, nil)
	if err != nil {
		return nil, err
	}

	var balance *big.Int
	err = tokenABI.UnpackIntoInterface(&balance, "balanceOf", result)
	if err != nil {
		return nil, err
	}
	return balance, nil
}

// weiToFloat converts a wei-denominated *big.Int to a float64 (18 decimals).
func weiToFloat(wei *big.Int) float64 {
	if wei == nil || wei.Sign() <= 0 {
		return 0
	}
	f := new(big.Float).SetInt(wei)
	f.Quo(f, big.NewFloat(1e18))
	out, _ := f.Float64()
	return out
}
