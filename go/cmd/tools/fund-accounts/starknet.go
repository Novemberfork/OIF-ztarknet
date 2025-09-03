package main

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"os"

	"time"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/oif-starknet/go/pkg/starknetutil"
	"github.com/NethermindEth/oif-starknet/go/solvercore/config"
	"github.com/NethermindEth/starknet.go/account"
	"github.com/NethermindEth/starknet.go/rpc"
	"github.com/NethermindEth/starknet.go/utils"
)

func fundStarknet(amount *big.Int) {
	fmt.Printf("📡 Funding Starknet network...\n")
	
	// Load network configuration
	config.InitializeNetworks()
	
	starknetConfig, exists := config.Networks["Starknet"]
	if !exists {
		log.Fatalf("Starknet network not found in config")
	}

	// Get MockERC20 address from environment
	tokenAddress := os.Getenv("STARKNET_DOG_COIN_ADDRESS")
	if tokenAddress == "" {
		log.Fatalf("STARKNET_DOG_COIN_ADDRESS not found in environment")
	}

	// Connect to Starknet
	client, err := rpc.NewProvider(starknetConfig.RPCURL)
	if err != nil {
		log.Fatalf("Failed to connect to Starknet: %v", err)
	}

	fmt.Printf("   📍 Network: Starknet (Chain ID: %d)\n", starknetConfig.ChainID)
	fmt.Printf("   🪙 MockERC20: %s\n", tokenAddress)

	// Get minter account (use Alice as minter)
	useLocalForks := os.Getenv("FORKING") == "true"
	var minterPrivateKey, minterPublicKey, minterAddress string
	
	if useLocalForks {
		minterPrivateKey = os.Getenv("LOCAL_STARKNET_ALICE_PRIVATE_KEY")
		minterPublicKey = os.Getenv("LOCAL_STARKNET_ALICE_PUBLIC_KEY")
		minterAddress = getEnvWithDefault("LOCAL_STARKNET_ALICE_ADDRESS", "0x13d9ee239f33fea4f8785b9e3870ade909e20a9599ae7cd62c1c292b73af1b7")
	} else {
		minterPrivateKey = os.Getenv("STARKNET_ALICE_PRIVATE_KEY")
		minterPublicKey = os.Getenv("STARKNET_ALICE_PUBLIC_KEY")
		minterAddress = getEnvWithDefault("STARKNET_ALICE_ADDRESS", "0x13d9ee239f33fea4f8785b9e3870ade909e20a9599ae7cd62c1c292b73af1b7")
	}

	if minterPrivateKey == "" || minterPublicKey == "" {
		log.Fatalf("Starknet minter credentials not found (Alice's keys)")
	}

	// Create minter account
	minterAddrFelt, err := utils.HexToFelt(minterAddress)
	if err != nil {
		log.Fatalf("Failed to convert minter address to felt: %v", err)
	}

	minterKs := account.NewMemKeystore()
	minterPrivKeyBI, ok := new(big.Int).SetString(minterPrivateKey, 0)
	if !ok {
		log.Fatalf("Failed to parse minter private key")
	}
	minterKs.Put(minterPublicKey, minterPrivKeyBI)

	minterAccount, err := account.NewAccount(client, minterAddrFelt, minterPublicKey, minterKs, account.CairoV2)
	if err != nil {
		log.Fatalf("Failed to create minter account: %v", err)
	}

	// Get recipient addresses
	recipients := getStarknetRecipients(useLocalForks)
	
	// Fund each recipient
	for _, recipient := range recipients {
		fmt.Printf("   💸 Funding %s (%s)...\n", recipient.Name, recipient.Address)
		
		// Check current balance
		currentBalance, err := starknetutil.ERC20Balance(client, tokenAddress, recipient.Address)
		if err == nil {
			fmt.Printf("     📊 Current balance: %s\n", starknetutil.FormatTokenAmount(currentBalance, 18))
		}

		// Convert addresses to felts for the mint call
		tokenFelt, err := utils.HexToFelt(tokenAddress)
		if err != nil {
			log.Printf("     ❌ Failed to convert token address to felt: %v", err)
			continue
		}

		recipientFelt, err := utils.HexToFelt(recipient.Address)
		if err != nil {
			log.Printf("     ❌ Failed to convert recipient address to felt: %v", err)
			continue
		}

		// Convert amount to two felts (low, high) for u256
		amountLow, amountHigh := starknetutil.ConvertBigIntToU256Felts(amount)
		
		// Build mint calldata: mint(to: ContractAddress, amount: u256)
		mintCalldata := []*felt.Felt{recipientFelt, amountLow, amountHigh}
		
		// Create mint transaction
		mintCall := rpc.InvokeFunctionCall{
			ContractAddress: tokenFelt,
			FunctionName:    "mint",
			CallData:        mintCalldata,
		}
		
		// Send mint transaction
		mintTx, err := minterAccount.BuildAndSendInvokeTxn(context.Background(), []rpc.InvokeFunctionCall{mintCall}, nil)
		if err != nil {
			log.Printf("     ❌ Failed to send mint transaction for %s: %v", recipient.Name, err)
			continue
		}
		
		fmt.Printf("     🚀 Mint transaction: %s\n", mintTx.Hash.String())
		
		// Wait for confirmation
		_, err = minterAccount.WaitForTransactionReceipt(context.Background(), mintTx.Hash, 2*time.Second)
		if err != nil {
			log.Printf("     ❌ Failed to wait for transaction confirmation: %v", err)
			continue
		}
		
		fmt.Printf("     ✅ Minted %s tokens\n", starknetutil.FormatTokenAmount(amount, 18))
		
		// Verify new balance
		newBalance, err := starknetutil.ERC20Balance(client, tokenAddress, recipient.Address)
		if err == nil {
			fmt.Printf("     💰 New balance: %s\n", starknetutil.FormatTokenAmount(newBalance, 18))
		}
	}
}

type StarknetRecipient struct {
	Name    string
	Address string
}

func getStarknetRecipients(useLocalForks bool) []StarknetRecipient {
	var recipients []StarknetRecipient
	
	// Alice
	var aliceAddr string
	if useLocalForks {
		aliceAddr = getEnvWithDefault("LOCAL_STARKNET_ALICE_ADDRESS", "0x13d9ee239f33fea4f8785b9e3870ade909e20a9599ae7cd62c1c292b73af1b7")
	} else {
		aliceAddr = getEnvWithDefault("STARKNET_ALICE_ADDRESS", "0x13d9ee239f33fea4f8785b9e3870ade909e20a9599ae7cd62c1c292b73af1b7")
	}
	recipients = append(recipients, StarknetRecipient{
		Name:    "Alice",
		Address: aliceAddr,
	})

	// Solver
	var solverAddr string
	if useLocalForks {
		solverAddr = getEnvWithDefault("LOCAL_STARKNET_SOLVER_ADDRESS", "0x2af9427c5a277474c079a1283c880ee8a6f0f8fbf73ce969c08d88befec1bba")
	} else {
		solverAddr = getEnvWithDefault("STARKNET_SOLVER_ADDRESS", "0x2af9427c5a277474c079a1283c880ee8a6f0f8fbf73ce969c08d88befec1bba")
	}
	recipients = append(recipients, StarknetRecipient{
		Name:    "Solver",
		Address: solverAddr,
	})

	return recipients
}
