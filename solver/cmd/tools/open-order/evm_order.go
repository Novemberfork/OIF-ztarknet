package openorder

// EVM order creation logic - extracted from the original open-order/evm/main.go
// This handles creating orders on EVM chains (Ethereum, Optimism, Arbitrum, Base)

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"math/big"
	"os"
	"strings"
	"time"

	"github.com/NethermindEth/oif-starknet/solver/pkg/envutil"
	"github.com/NethermindEth/oif-starknet/solver/pkg/ethutil"
	"github.com/NethermindEth/oif-starknet/solver/solvercore/config"
	contracts "github.com/NethermindEth/oif-starknet/solver/solvercore/contracts"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/holiman/uint256"
)

// Common string constants
const (
	StarknetNetworkName = starknetNetworkName
	AliceUserName       = "Alice"
	// Random number generation constants
	randomBytesLength = 8
	// Token amount generation constants
	minTokenAmount = 100
	maxTokenAmount = 10000
	minDeltaAmount = 1
	maxDeltaAmount = 10
	// Token decimals (18 for most ERC20 tokens)
	tokenDecimals = 18
	// Order deadline (24 hours from now)
	orderDeadlineHours = 24
	// Token amount constants for test orders
	testInputAmount          = 1001
	testOutputAmount         = 1000
	testOutputAmountStarknet = 999
	// Network name constants
	starknetNetworkName = "Starknet"
)

// secureRandomInt generates a secure random integer in the range [0, max)
func secureRandomInt(maxValue int) int {
	if maxValue <= 0 {
		return 0
	}

	// Generate random bytes
	b := make([]byte, randomBytesLength)
	_, err := rand.Read(b)
	if err != nil {
		// Fallback to time-based seed if crypto/rand fails
		return int(time.Now().UnixNano()) % maxValue
	}

	// Convert bytes to int
	var result int64
	for i := 0; i < 8; i++ {
		result = result*256 + int64(b[i])
	}

	if result < 0 {
		result = -result
	}

	return int(result % int64(maxValue))
}

// OrderData represents the data for creating an order
type OrderData struct {
	OriginChainID      *big.Int
	DestinationChainID *big.Int
	User               string
	Recipient          string // Added explicit Recipient field
	OpenDeadline       *big.Int
	FillDeadline       *big.Int
	MaxSpent           []TokenAmount
	MinReceived        []TokenAmount
}

// ABIOrderData struct for ABI encoding (matches Solidity interface)
type ABIOrderData struct {
	Sender             [32]byte
	Recipient          [32]byte
	InputToken         [32]byte
	OutputToken        [32]byte
	AmountIn           *big.Int
	AmountOut          *big.Int
	SenderNonce        *big.Int
	OriginDomain       uint32
	DestinationDomain  uint32
	DestinationSettler [32]byte
	FillDeadline       uint32
	Data               []byte
}

// TokenAmount represents a token and its amount
type TokenAmount struct {
	Token   string
	Amount  *uint256.Int
	ChainID *big.Int
}

// IsValid checks if the order data is valid
func (od *OrderData) IsValid() bool {
	// Check that origin and destination are different
	if od.OriginChainID.Cmp(od.DestinationChainID) == 0 {
		return false
	}

	// Check that user address is valid (basic check)
	if len(od.User) != 42 || od.User[:2] != "0x" {
		return false
	}

	// Check that deadlines are in the future
	now := big.NewInt(time.Now().Unix())
	if od.OpenDeadline.Cmp(now) <= 0 {
		return false
	}

	// Check that fill deadline is after open deadline
	if od.FillDeadline.Cmp(od.OpenDeadline) <= 0 {
		return false
	}

	// Check that we have tokens to spend and receive
	if len(od.MaxSpent) == 0 || len(od.MinReceived) == 0 {
		return false
	}

	return true
}

// Helper functions for uint256 conversion
// ToUint256 converts *big.Int to uint256.Int
func ToUint256(bi *big.Int) *uint256.Int {
	if bi == nil {
		return uint256.NewInt(0)
	}
	u, _ := uint256.FromBig(bi)
	return u
}

// ToBigInt converts uint256.Int to *big.Int
func ToBigInt(u *uint256.Int) *big.Int {
	return u.ToBig()
}

// CreateTokenAmount creates a token amount using uint256 for better performance
func CreateTokenAmount(tokens int64, decimals int) *big.Int {
	// Use uint256 for the arithmetic operations
	tokenU := uint256.NewInt(uint64(tokens))
	decimalsU := uint256.NewInt(10)
	decimalsU.Exp(decimalsU, uint256.NewInt(uint64(decimals)))
	result := new(uint256.Int)
	result.Mul(tokenU, decimalsU)
	return result.ToBig()
}

// NetworkConfig represents a single network configuration
type NetworkConfig struct {
	name             string
	url              string
	chainID          uint64
	hyperlaneAddress string
	dogCoinAddress   string
}

// OrderConfig represents order configuration
type OrderConfig struct {
	OriginChain      string
	DestinationChain string
	InputToken       string
	OutputToken      string
	InputAmount      *big.Int
	OutputAmount     *big.Int
	User             string
	OpenDeadline     uint32
	FillDeadline     uint32
}

// OrderParams contains the actual addresses and amounts for order execution
type OrderParams struct {
	OriginChainID      *big.Int
	DestinationChainID *big.Int
	InputTokenAddress  string // Properly padded bytes32 as hex string
	OutputTokenAddress string // Properly padded bytes32 as hex string
	RecipientAddress   string // Properly padded bytes32 as hex string
	SettlerAddress     string // Properly padded bytes32 as hex string
	InputAmount        *big.Int
	OutputAmount       *big.Int
	User               string
	OpenDeadline       uint32
	FillDeadline       uint32
}

// OnchainCrossChainOrder struct matching the Solidity interface
type OnchainCrossChainOrder struct {
	FillDeadline  uint32
	OrderDataType [32]byte
	OrderData     []byte
}

// Test user configuration (Alice-only for orders, Solver for fills)
var testUsers = []struct {
	name       string
	privateKey string
	address    string
}{
	{"Alice", "ALICE_PRIVATE_KEY", getEnvWithDefault("ALICE_PUB_KEY", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8")},
}

// initializeTestUsers initializes the test user configuration after .env is loaded
func initializeTestUsers() {
	// Use conditional environment variable logic based on IS_DEVNET
	aliceAddr := envutil.GetAlicePublicKey()
	privateKeyVar := envutil.GetConditionalAccountEnv("ALICE_PRIVATE_KEY")

	testUsers = []struct {
		name       string
		privateKey string
		address    string
	}{
		{"Alice", privateKeyVar, aliceAddr},
	}
}

// loadNetworks loads network configuration from centralized config and environment variables
func loadNetworks() []NetworkConfig {
	// Initialize networks from centralized config after .env is loaded
	config.InitializeNetworks()

	// Build networks from centralized config
	networkNames := config.GetNetworkNames()
	networks := make([]NetworkConfig, 0, len(networkNames))

	for _, networkName := range networkNames {
		networkConfig := config.Networks[networkName]

		// Determine dog coin address based on network type
		var dogCoinAddr string
		if networkName == starknetNetworkName {
			dogCoinAddr = os.Getenv("STARKNET_DOG_COIN_ADDRESS")
		} else if networkName == "Ztarknet" {
			dogCoinAddr = os.Getenv("ZTARKNET_DOG_COIN_ADDRESS")
		} else {
			dogCoinAddr = os.Getenv(strings.ToUpper(networkName) + "_DOG_COIN_ADDRESS")
		}

		networks = append(networks, NetworkConfig{
			name:             networkConfig.Name,
			url:              networkConfig.RPCURL,
			chainID:          networkConfig.ChainID,
			hyperlaneAddress: networkConfig.HyperlaneAddress,
			dogCoinAddress:   dogCoinAddr,
		})
	}

	return networks
}

// getHyperlaneDomain returns the Hyperlane domain ID for a given network
func getHyperlaneDomain(networkName string) uint32 {
	domain, err := config.GetHyperlaneDomain(networkName)
	if err != nil {
		return 0
	}
	return uint32(domain)
}

// RunEVMOrder creates an EVM order based on the command
func RunEVMOrder(command string) {
	fmt.Println("🎯 Running EVM order creation...")

	// Load configuration (this loads .env and initializes networks)
	_, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize test users after .env is loaded
	initializeTestUsers()

	// Load network configuration
	networks := loadNetworks()

	switch command {
	case "random-to-evm":
		openRandomToEvm(networks)
	case "random-to-sn":
		openRandomToStarknet(networks)
	case "default-evm-evm":
		openDefaultEvmToEvm(networks)
	case "default-evm-sn":
		openDefaultEvmToStarknet(networks)
	default:
		// Default to random EVM order
		openRandomToEvm(networks)
	}
}

// RunEVMOrderWithDest creates an EVM order with specific origin and destination
func RunEVMOrderWithDest(command, originChain, destinationChain string) {
	fmt.Printf("🎯 Running EVM order creation: %s → %s\n", originChain, destinationChain)

	// Load configuration (this loads .env and initializes networks)
	_, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize test users after .env is loaded
	initializeTestUsers()

	// Load network configuration
	networks := loadNetworks()

	// Random amounts - ensure solver profitability
	outputAmount := CreateTokenAmount(int64(secureRandomInt(maxTokenAmount-minTokenAmount+1)+minTokenAmount), tokenDecimals)
	delta := CreateTokenAmount(int64(secureRandomInt(maxDeltaAmount-minDeltaAmount+1)+minDeltaAmount), tokenDecimals)
	inputAmount := new(big.Int).Add(outputAmount, delta)

	order := OrderConfig{
		OriginChain:      originChain,
		DestinationChain: destinationChain,
		InputToken:       "DogCoin",
		OutputToken:      "DogCoin",
		InputAmount:      inputAmount,
		OutputAmount:     outputAmount,
		User:             AliceUserName,
		OpenDeadline:     uint32(time.Now().Add(1 * time.Hour).Unix()),
		FillDeadline:     uint32(time.Now().Add(orderDeadlineHours * time.Hour).Unix()),
	}

	executeOrder(&order, networks)
}

func openRandomToEvm(networks []NetworkConfig) {
	fmt.Println("🎲 Opening Random Test Order...")

	// Random origin and destination chains (exclude Starknet from origins)
	var evmNetworks []NetworkConfig
	for _, n := range networks {
		if n.name != starknetNetworkName {
			evmNetworks = append(evmNetworks, n)
		}
	}
	if len(evmNetworks) == 0 {
		log.Fatalf("no EVM networks configured")
	}

	originIdx := secureRandomInt(len(evmNetworks))
	destIdx := secureRandomInt(len(evmNetworks)) // Only pick from EVM networks for EVM-EVM orders
	for destIdx == originIdx {
		destIdx = (originIdx + 1) % len(evmNetworks) // Ensure different EVM chain
	}

	// Always use Alice for orders
	user := AliceUserName

	// Random amounts (100-10000 tokens) - ensure solver profitability
	// Alice provides InputAmount, receives OutputAmount
	// Solver receives InputAmount (MinReceived), provides OutputAmount (MaxSpent)
	// For profitability: InputAmount (MinReceived) > OutputAmount (MaxSpent)
	outputAmount := CreateTokenAmount(int64(secureRandomInt(maxTokenAmount-minTokenAmount+1)+minTokenAmount), tokenDecimals) // 100-10000 tokens (what solver provides)
	delta := CreateTokenAmount(int64(secureRandomInt(maxDeltaAmount-minDeltaAmount+1)+minDeltaAmount), tokenDecimals)        // 1-10 tokens profit margin
	inputAmount := new(big.Int).Add(outputAmount, delta)                                                                     // slightly more to ensure solver profit

	order := OrderConfig{
		OriginChain:      evmNetworks[originIdx].name,
		DestinationChain: evmNetworks[destIdx].name,
		InputToken:       "DogCoin",
		OutputToken:      "DogCoin",
		InputAmount:      inputAmount,
		OutputAmount:     outputAmount,
		User:             user,
		OpenDeadline:     uint32(time.Now().Add(1 * time.Hour).Unix()),
		FillDeadline:     uint32(time.Now().Add(orderDeadlineHours * time.Hour).Unix()),
	}

	executeOrder(&order, networks)
}

func openRandomToStarknet(networks []NetworkConfig) {
	fmt.Println("🎲 Opening Random EVM → Starknet Test Order...")

	// Pick random EVM origin (exclude Starknet)
	var evmNetworks []NetworkConfig
	for _, n := range networks {
		if n.name != starknetNetworkName {
			evmNetworks = append(evmNetworks, n)
		}
	}
	if len(evmNetworks) == 0 {
		log.Fatalf("no EVM networks configured")
	}
	origin := evmNetworks[secureRandomInt(len(evmNetworks))]

	// Random amounts - ensure solver profitability
	// Alice provides InputAmount, receives OutputAmount
	// Solver receives InputAmount (MinReceived), provides OutputAmount (MaxSpent)
	// For profitability: InputAmount (MinReceived) > OutputAmount (MaxSpent)
	outputAmount := CreateTokenAmount(int64(secureRandomInt(maxTokenAmount-minTokenAmount+1)+minTokenAmount), tokenDecimals) // 100-10000 tokens (what solver provides)
	delta := big.NewInt(int64(secureRandomInt(maxDeltaAmount-minDeltaAmount+1) + minDeltaAmount))                            // 1-10 tokens profit margin
	inputAmount := new(big.Int).Add(outputAmount, delta)                                                                     // slightly more to ensure solver profit

	order := OrderConfig{
		OriginChain:      origin.name,
		DestinationChain: starknetNetworkName,
		InputToken:       "DogCoin",
		OutputToken:      "DogCoin",
		InputAmount:      inputAmount,
		OutputAmount:     outputAmount,
		User:             AliceUserName,
		OpenDeadline:     uint32(time.Now().Add(1 * time.Hour).Unix()),
		FillDeadline:     uint32(time.Now().Add(orderDeadlineHours * time.Hour).Unix()),
	}

	executeOrder(&order, networks)
}

func openDefaultEvmToEvm(networks []NetworkConfig) {
	fmt.Println("🎯 Opening Default EVM → EVM Test Order...")

	order := OrderConfig{
		OriginChain:      "Ethereum",
		DestinationChain: "Optimism",
		InputToken:       "DogCoin",
		OutputToken:      "DogCoin",
		InputAmount:      CreateTokenAmount(testInputAmount, tokenDecimals), // 1001 tokens (what solver receives)
		OutputAmount:     CreateTokenAmount(1000, 18),                       // 1000 tokens (what solver provides)
		User:             AliceUserName,
		OpenDeadline:     uint32(time.Now().Add(1 * time.Hour).Unix()),
		FillDeadline:     uint32(time.Now().Add(orderDeadlineHours * time.Hour).Unix()),
	}

	executeOrder(&order, networks)
}

func openDefaultEvmToStarknet(networks []NetworkConfig) {
	fmt.Println("🎯 Opening Default EVM → Starknet Test Order...")

	order := OrderConfig{
		OriginChain:      "Ethereum",
		DestinationChain: starknetNetworkName,
		InputToken:       "DogCoin",
		OutputToken:      "DogCoin",
		InputAmount:      CreateTokenAmount(testInputAmount, tokenDecimals), // 1001 tokens (what solver receives)
		OutputAmount:     CreateTokenAmount(1000, 18),                       // 1000 tokens (what solver provides)
		User:             AliceUserName,
		OpenDeadline:     uint32(time.Now().Add(1 * time.Hour).Unix()),
		FillDeadline:     uint32(time.Now().Add(orderDeadlineHours * time.Hour).Unix()),
	}

	executeOrder(&order, networks)
}

func executeOrder(order *OrderConfig, networks []NetworkConfig) {
	fmt.Printf("\n📋 Executing Order: %s → %s\n", order.OriginChain, order.DestinationChain)

	// Find origin network
	var originNetwork *NetworkConfig
	for _, network := range networks {
		if network.name == order.OriginChain {
			originNetwork = &network
			break
		}
	}

	if originNetwork == nil {
		log.Fatalf("Origin network not found: %s", order.OriginChain)
	}

	// Get user private key using conditional environment variable logic
	var userKey string
	isDevnet := os.Getenv("IS_DEVNET") == "true"
	if isDevnet {
		userKey = os.Getenv(fmt.Sprintf("LOCAL_%s_PRIVATE_KEY", strings.ToUpper(order.User)))
	} else {
		userKey = os.Getenv(fmt.Sprintf("%s_PRIVATE_KEY", strings.ToUpper(order.User)))
	}
	if userKey == "" {
		log.Fatalf("Private key not found for user: %s (IS_DEVNET=%s)", order.User, os.Getenv("IS_DEVNET"))
	}

	// Parse private key
	privateKey, err := ethutil.ParsePrivateKey(userKey)
	if err != nil {
		log.Fatalf("Failed to parse private key for %s: %v", order.User, err)
	}

	// Create auth
	auth, err := ethutil.NewTransactor(big.NewInt(int64(originNetwork.chainID)), privateKey)
	if err != nil {
		log.Fatalf("Failed to create auth: %v", err)
	}

	// Connect to origin network
	client, err := ethclient.Dial(originNetwork.url)
	if err != nil {
		log.Fatalf("Failed to connect to %s: %v", order.OriginChain, err)
	}

	// Get current gas price
	gasPrice, err := ethutil.SuggestGas(client)
	if err != nil {
		client.Close()
		log.Fatalf("Failed to get gas price: %v", err)
	}
	auth.GasPrice = gasPrice

	// Find destination network (check all networks, including Starknet)
	var destinationNetwork *NetworkConfig

	// First check EVM networks
	for _, network := range networks {
		if network.name == order.DestinationChain {
			destinationNetwork = &network
			break
		}
	}

	// If not found in EVM networks, check if it's Starknet or Ztarknet
	if destinationNetwork == nil && order.DestinationChain == starknetNetworkName {
		// Create NetworkConfig for Starknet destination
		starknetConfig := config.Networks[starknetNetworkName]
		destinationNetwork = &NetworkConfig{
			name:             starknetNetworkName,
			url:              starknetConfig.RPCURL,
			chainID:          starknetConfig.ChainID,
			hyperlaneAddress: starknetConfig.HyperlaneAddress,
			dogCoinAddress:   os.Getenv("STARKNET_DOG_COIN_ADDRESS"), // From env
		}
	}

	if destinationNetwork == nil && order.DestinationChain == "Ztarknet" {
		// Create NetworkConfig for Ztarknet destination
		ztarknetConfig := config.Networks["Ztarknet"]
		destinationNetwork = &NetworkConfig{
			name:             "Ztarknet",
			url:              ztarknetConfig.RPCURL,
			chainID:          ztarknetConfig.ChainID,
			hyperlaneAddress: ztarknetConfig.HyperlaneAddress,
			dogCoinAddress:   os.Getenv("ZTARKNET_DOG_COIN_ADDRESS"), // From env
		}
	}

	if destinationNetwork == nil {
		log.Fatalf("Destination network not found: %s", order.DestinationChain)
	}

	// Read localDomain from the origin Hyperlane contract to guarantee it matches on-chain
	localDomain, err := getLocalDomain(client, common.HexToAddress(originNetwork.hyperlaneAddress))
	if err != nil {
		client.Close()
		log.Fatalf("Failed to read localDomain from origin contract: %v", err)
	}

	// Preflight: balances and allowances on origin for input token
	inputTokenStr := originNetwork.dogCoinAddress
	inputTokenAddr := common.HexToAddress(inputTokenStr)
	owner := auth.From
	spender := common.HexToAddress(originNetwork.hyperlaneAddress)

	// Get initial balances
	initialUserBalance, err := ethutil.ERC20Balance(client, inputTokenAddr, owner)
	if err == nil {
		fmt.Printf("   🔍 Initial InputToken balance(owner): %s\n", initialUserBalance.String())
	} else {
		fmt.Printf("   ⚠️  Could not read initial balance: %v\n", err)
	}

	initialHyperlaneBalance, err := ethutil.ERC20Balance(client, inputTokenAddr, spender)
	if err == nil {
		fmt.Printf("   🔍 Initial InputToken balance(hyperlane): %s\n", initialHyperlaneBalance.String())
	} else {
		fmt.Printf("   ⚠️  Could not read initial hyperlane balance: %v\n", err)
	}

	// Check if Alice has sufficient tokens for the order
	requiredAmount := order.InputAmount
	if initialUserBalance == nil || initialUserBalance.Cmp(requiredAmount) < 0 {
		fmt.Printf("   ⚠️  Insufficient balance! Alice needs %s tokens but has %s\n",
			ethutil.FormatTokenAmount(requiredAmount, 18),
			ethutil.FormatTokenAmount(initialUserBalance, 18))
		fmt.Printf("   💡 Please mint tokens manually using the MockERC20 contract's mint() function\n")
		fmt.Printf("   📝 Contract address: %s\n", inputTokenStr)
		fmt.Printf("   🔧 Call: mint(\"%s\", \"%s\")\n", owner.Hex(), requiredAmount.String())
		client.Close()
		log.Fatalf("Insufficient token balance for order creation")
	} else {
		fmt.Printf("   ✅ Alice has sufficient tokens (%s)\n", ethutil.FormatTokenAmount(initialUserBalance, 18))
	}

	// Check allowance
	allowance, err := ethutil.ERC20Allowance(client, inputTokenAddr, owner, spender)
	if err == nil {
		fmt.Printf("   🔍 Current allowance(owner->hyperlane): %s\n", allowance.String())
	} else {
		fmt.Printf("   ⚠️  Could not read allowance: %v\n", err)
	}

	// If allowance is insufficient, approve the Hyperlane contract
	requiredAmount = order.InputAmount
	if allowance.Cmp(requiredAmount) < 0 {
		fmt.Printf("   🔄 Insufficient allowance, approving %s tokens...\n", requiredAmount.String())

		// Approve the Hyperlane contract to spend the required amount
		approveTx, err := ethutil.ERC20Approve(client, auth, inputTokenAddr, spender, requiredAmount)
		if err != nil {
			client.Close()
			log.Fatalf("Failed to approve tokens: %v", err)
		}

		fmt.Printf("   🚀 Approval transaction sent: %s\n", approveTx.Hash().Hex())

		// Wait for approval transaction to be mined
		fmt.Printf("   ⏳ Waiting for approval confirmation...\n")
		receipt, err := ethutil.WaitForTransaction(client, approveTx)
		if err != nil {
			client.Close()
			log.Fatalf("Failed to wait for approval transaction: %v", err)
		}

		if receipt.Status != 1 {
			client.Close()
			log.Fatalf("Approval transaction failed")
		}

		fmt.Printf("   ✅ Approval confirmed!\n")
	} else {
		fmt.Printf("   ✅ Sufficient allowance already exists\n")
	}

	// Pick a fresh senderNonce recognized by the contract to avoid InvalidNonce
	senderNonce, err := pickValidSenderNonce(client, common.HexToAddress(originNetwork.hyperlaneAddress), auth.From)
	if err != nil {
		client.Close()
		log.Fatalf("Failed to pick a valid sender nonce: %v", err)
	}

	// Build the order data
	orderData := buildOrderData(order, originNetwork, destinationNetwork, localDomain, senderNonce)


	// Build the OnchainCrossChainOrder
	crossChainOrder := OnchainCrossChainOrder{
		FillDeadline:  order.FillDeadline,
		OrderDataType: getOrderDataTypeHash(),
		OrderData:     encodeOrderData(&orderData, senderNonce, networks),
	}

	// Debug: Log the encoded data
	// fmt.Printf("🔍 Encoded Order Data Debug:\n")
	// fmt.Printf("   • FillDeadline: %d\n", crossChainOrder.FillDeadline)
	// fmt.Printf("   • OrderDataType: %x\n", crossChainOrder.OrderDataType)
	// fmt.Printf("   • OrderData length: %d bytes\n", len(crossChainOrder.OrderData))

	// Use generated bindings for open()
	contract, err := contracts.NewHyperlane7683(common.HexToAddress(originNetwork.hyperlaneAddress), client)
	if err != nil {
		client.Close()
		log.Fatalf("Failed to bind Hyperlane7683: %v", err)
	}

	tx, err := contract.Open(auth, contracts.OnchainCrossChainOrder{
		FillDeadline:  crossChainOrder.FillDeadline,
		OrderDataType: crossChainOrder.OrderDataType,
		OrderData:     crossChainOrder.OrderData,
	})
	if err != nil {
		client.Close()
		log.Fatalf("Failed to send open transaction: %v", err)
	}

	fmt.Printf("   🚀 Transaction sent: %s\n", tx.Hash().Hex())
	fmt.Printf("   ⏳ Waiting for confirmation...\n")

	// Wait for transaction confirmation
	receipt, err := ethutil.WaitForTransaction(client, tx)
	if err != nil {
		client.Close()
		log.Fatalf("Failed to wait for transaction confirmation: %v", err)
	}

	defer client.Close()

	if receipt.Status == 1 {
		fmt.Printf("✅ Order opened successfully!\n")
		fmt.Printf("📊 Gas used: %d\n", receipt.GasUsed)
	} else {
		fmt.Printf("❌ Order opening failed\n")
		fmt.Printf("🔍 Transaction hash: %s\n", tx.Hash().Hex())
		fmt.Printf("📊 Gas used: %d\n", receipt.GasUsed)

		// Try to get more details about the failure
		fmt.Printf("   🔍 Checking transaction details...\n")
		txDetails, _, err := client.TransactionByHash(context.Background(), tx.Hash())
		if err != nil {
			fmt.Printf("❌ Could not retrieve transaction details: %v\n", err)
		} else {
			fmt.Printf("📝 Transaction data: 0x%x\n", txDetails.Data())
		}
	}

	fmt.Printf("\n🎉 Order execution completed!\n")
	fmt.Printf("📊 Order Summary:\n")
	fmt.Printf("   Input Amount: %s\n", order.InputAmount.String())
	fmt.Printf("   Output Amount: %s\n", order.OutputAmount.String())
	fmt.Printf("   Origin Chain: %s\n", order.OriginChain)
	fmt.Printf("   Destination Chain: %s\n", order.DestinationChain)
}

func buildOrderData(order *OrderConfig, originNetwork, destinationNetwork *NetworkConfig, originDomain uint32, _ *big.Int) OrderData {
	// Input token from origin network, output token from destination network
	// inputTokenAddr := originNetwork.dogCoinAddress
	// outputTokenAddr := destinationNetwork.dogCoinAddress

	// Convert destination settler depending on destination chain type
	var destSettlerBytes [32]byte
	if destinationNetwork.name == starknetNetworkName {
		// Use Starknet Hyperlane address from config (.env) as raw 32 bytes (felt)
		if snNetwork, exists := config.Networks[starknetNetworkName]; exists {
			starknetHyperlaneAddr := os.Getenv("STARKNET_HYPERLANE_ADDRESS")
			if starknetHyperlaneAddr != "" {
				destSettlerBytes = hexToBytes32(starknetHyperlaneAddr)
			} else if snNetwork.HyperlaneAddress != "" {
				destSettlerBytes = hexToBytes32(snNetwork.HyperlaneAddress)
			}
		}
		if destSettlerBytes == ([32]byte{}) {
			log.Printf("⚠️  Starknet Hyperlane address not found in config; destinationSettler will be zero")
		}
	} else if destinationNetwork.name == "Ztarknet" {
		// Use Ztarknet Hyperlane address from config (.env) as raw 32 bytes (felt)
		if ztarknetNetwork, exists := config.Networks["Ztarknet"]; exists {
			ztarknetHyperlaneAddr := os.Getenv("ZTARKNET_HYPERLANE_ADDRESS")
			if ztarknetHyperlaneAddr != "" {
				destSettlerBytes = hexToBytes32(ztarknetHyperlaneAddr)
			} else if ztarknetNetwork.HyperlaneAddress != "" {
				destSettlerBytes = hexToBytes32(ztarknetNetwork.HyperlaneAddress)
			}
		}
		if destSettlerBytes == ([32]byte{}) {
			log.Printf("⚠️  Ztarknet Hyperlane address not found in config; destinationSettler will be zero")
		}
	} else {
		// EVM router is 20-byte address left-padded to 32
		destSettler := common.HexToAddress(destinationNetwork.hyperlaneAddress)
		copy(destSettlerBytes[12:], destSettler.Bytes())
	}

	// Get the destination chain ID (Hyperlane domain)
	destinationChainID := getHyperlaneDomain(destinationNetwork.name)

	// Build proper OrderData with actual token amounts
	// Map token names to actual addresses
	inputTokenAddr := originNetwork.dogCoinAddress

	// Determine Recipient based on destination network
	var recipient string
	if destinationNetwork.name == starknetNetworkName {
		// Use Starknet Alice address
		recipient = envutil.GetStarknetAliceAddress()
	} else if destinationNetwork.name == "Ztarknet" {
		// Use Ztarknet Alice address
		recipient = envutil.GetZtarknetAliceAddress()
	} else {
		// For EVM destinations, use the sender's EVM address (Alice)
		// Get the actual user address from testUsers array
		for _, user := range testUsers {
			if user.name == order.User {
				recipient = user.address
				break
			}
		}
	}

	// For cross-chain orders:
	// - MaxSpent: What the solver needs to provide (destination chain tokens)
	// - MinReceived: What the solver will receive (origin chain tokens)
	var maxSpent, minReceived []TokenAmount

	// Set up token amounts (same for both EVM→Starknet and EVM→EVM orders)
	maxSpent = []TokenAmount{
		{
			Token:   destinationNetwork.dogCoinAddress, // Destination chain token (string)
			Amount:  uint256.MustFromBig(order.OutputAmount), // Amount solver needs to provide
			ChainID: big.NewInt(int64(destinationChainID)),   // Destination chain ID
		},
	}
	minReceived = []TokenAmount{
		{
			Token:   inputTokenAddr,                          // Origin chain token (string)
			Amount:  uint256.MustFromBig(order.InputAmount), // Amount solver will receive
			ChainID: big.NewInt(int64(originDomain)),        // Origin chain ID
		},
	}

	return OrderData{
		OriginChainID:      big.NewInt(int64(originDomain)),
		DestinationChainID: big.NewInt(int64(destinationChainID)),
		User:               order.User,
		Recipient:          recipient,
		OpenDeadline:       big.NewInt(time.Now().Add(1 * time.Hour).Unix()),
		FillDeadline:       big.NewInt(int64(order.FillDeadline)),
		MaxSpent:           maxSpent,
		MinReceived:        minReceived,
	}
}

// getLocalDomain reads the `localDomain()` from the Hyperlane7683 contract on the connected chain
func getLocalDomain(client *ethclient.Client, contractAddress common.Address) (uint32, error) {
	abiStr := `[{"inputs":[],"name":"localDomain","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"}]`

	parsedABI, err := abi.JSON(strings.NewReader(abiStr))
	if err != nil {
		return 0, err
	}

	data, err := parsedABI.Pack("localDomain")
	if err != nil {
		return 0, err
	}

	msg := ethereum.CallMsg{
		From:            common.Address{},
		To:              &contractAddress,
		Gas:             0,
		GasPrice:        nil,
		GasFeeCap:       nil,
		GasTipCap:       nil,
		Value:           nil,
		Data:            data,
		AccessList:      nil,
		BlobGasFeeCap:   nil,
		BlobHashes:      nil,
		AuthorizationList: nil,
	}
	result, err := client.CallContract(context.Background(), msg, nil)
	if err != nil {
		return 0, err
	}

	var domain uint32
	if err := parsedABI.UnpackIntoInterface(&domain, "localDomain", result); err != nil {
		return 0, err
	}

	return domain, nil
}

// isValidNonce calls the contract to check whether a nonce is usable for a given address
func isValidNonce(client *ethclient.Client, contractAddress, from common.Address, nonce *big.Int) (bool, error) {
	abiStr := `[{"inputs":[{"internalType":"address","name":"_from","type":"address"},{"internalType":"uint256","name":"_nonce","type":"uint256"}],"name":"isValidNonce","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"}]`

	parsedABI, err := abi.JSON(strings.NewReader(abiStr))
	if err != nil {
		return false, err
	}

	data, err := parsedABI.Pack("isValidNonce", from, nonce)
	if err != nil {
		return false, err
	}

	msg := ethereum.CallMsg{
		From:            common.Address{},
		To:              &contractAddress,
		Gas:             0,
		GasPrice:        nil,
		GasFeeCap:       nil,
		GasTipCap:       nil,
		Value:           nil,
		Data:            data,
		AccessList:      nil,
		BlobGasFeeCap:   nil,
		BlobHashes:      nil,
		AuthorizationList: nil,
	}
	result, err := client.CallContract(context.Background(), msg, nil)
	if err != nil {
		return false, err
	}

	var valid bool
	if err := parsedABI.UnpackIntoInterface(&valid, "isValidNonce", result); err != nil {
		return false, err
	}
	return valid, nil
}

// pickValidSenderNonce finds a nonce that the contract reports as valid for the provided sender
func pickValidSenderNonce(client *ethclient.Client, contractAddress, from common.Address) (*big.Int, error) {
	// Start with a pseudo-random seed and probe upward
	seed := time.Now().Unix() % 1_000_000
	if seed < 1 {
		seed = 1
	}
	nonce := big.NewInt(seed)
	for i := 0; i < 1000; i++ {
		valid, err := isValidNonce(client, contractAddress, from, nonce)
		if err != nil {
			return nil, err
		}
		if valid {
			return new(big.Int).Set(nonce), nil
		}
		nonce = new(big.Int).Add(nonce, big.NewInt(1))
	}
	return nil, fmt.Errorf("could not find a valid sender nonce after 1000 attempts starting from %d", seed)
}

func getOrderDataTypeHash() [32]byte {
	// This should match OrderEncoder.orderDataType() from Solidity EXACTLY
	// Including field names and spacing
	orderDataType := "OrderData(bytes32 sender,bytes32 recipient,bytes32 inputToken,bytes32 outputToken,uint256 amountIn,uint256 amountOut,uint256 senderNonce,uint32 originDomain,uint32 destinationDomain,bytes32 destinationSettler,uint32 fillDeadline,bytes data)"
	hash := crypto.Keccak256Hash([]byte(orderDataType))
	return hash
}

// hexToBytes32 converts a hex string to bytes32, handling both EVM and Starknet addresses
func hexToBytes32(hexStr string) [32]byte {
	s := strings.TrimPrefix(hexStr, "0x")
	if len(s)%2 == 1 {
		s = "0" + s
	}
	b, err := hex.DecodeString(s)
	if err != nil {
		log.Fatalf("invalid hex for bytes32: %s (%v)", hexStr, err)
	}
	if len(b) > 32 {
		b = b[len(b)-32:]
	}
	var out [32]byte
	copy(out[32-len(b):], b)
	return out
}

func encodeOrderData(orderData *OrderData, senderNonce *big.Int, networks []NetworkConfig) []byte {
	// Convert OrderData to ABIOrderData for encoding
	abiOrderData := convertToABIOrderData(orderData, senderNonce, networks)


	// Pack as a tuple to match Solidity's abi.encode(order)
	tupleT, err := abi.NewType("tuple", "", []abi.ArgumentMarshaling{
		{Name: "sender", Type: "bytes32", InternalType: "", Components: nil, Indexed: false},
		{Name: "recipient", Type: "bytes32", InternalType: "", Components: nil, Indexed: false},
		{Name: "inputToken", Type: "bytes32", InternalType: "", Components: nil, Indexed: false},
		{Name: "outputToken", Type: "bytes32", InternalType: "", Components: nil, Indexed: false},
		{Name: "amountIn", Type: "uint256", InternalType: "", Components: nil, Indexed: false},
		{Name: "amountOut", Type: "uint256", InternalType: "", Components: nil, Indexed: false},
		{Name: "senderNonce", Type: "uint256", InternalType: "", Components: nil, Indexed: false},
		{Name: "originDomain", Type: "uint32", InternalType: "", Components: nil, Indexed: false},
		{Name: "destinationDomain", Type: "uint32", InternalType: "", Components: nil, Indexed: false},
		{Name: "destinationSettler", Type: "bytes32", InternalType: "", Components: nil, Indexed: false},
		{Name: "fillDeadline", Type: "uint32", InternalType: "", Components: nil, Indexed: false},
		{Name: "data", Type: "bytes", InternalType: "", Components: nil, Indexed: false},
	})
	if err != nil {
		log.Fatalf("Failed to define OrderData tuple type: %v", err)
	}

	args := abi.Arguments{{Type: tupleT, Name: "", Indexed: false}}

	encoded, err := args.Pack(abiOrderData)
	if err != nil {
		log.Fatalf("Failed to ABI-pack OrderData: %v", err)
	}

	return encoded
}

// convertToABIOrderData converts OrderData to ABIOrderData for ABI encoding
func convertToABIOrderData(orderData *OrderData, senderNonce *big.Int, networks []NetworkConfig) ABIOrderData {
	var senderBytes [32]byte
	var recipientBytes [32]byte
	var inputTokenBytes [32]byte
	var outputTokenBytes [32]byte
	var destinationSettlerBytes [32]byte

	// Convert user address to bytes32 (left-padded)
	// Get the actual user address from testUsers array
	var userAddr common.Address
	for _, user := range testUsers {
		if user.name == orderData.User {
			userAddr = common.HexToAddress(user.address)
			break
		}
	}
	if userAddr != (common.Address{}) {
		copy(senderBytes[12:], userAddr.Bytes()) // Left-pad to 32 bytes

		// For EVM→Starknet/Ztarknet orders, recipient should be the Starknet/Ztarknet user address
		// For EVM→EVM orders, recipient can be the same as sender
		if orderData.DestinationChainID.Uint64() == config.StarknetSepoliaChainID { // Starknet
			// Get Starknet user address using conditional environment variable logic
			starknetUserAddr := envutil.GetStarknetAliceAddress()
			if starknetUserAddr != "" {
				// Convert Starknet address to bytes32 (it's already 32 bytes)
				starknetBytes := hexToBytes32(starknetUserAddr)
				copy(recipientBytes[:], starknetBytes[:])
			} else {
				copy(recipientBytes[12:], userAddr.Bytes()) // Fallback to EVM address
			}
		} else if orderData.DestinationChainID.Uint64() == 10066329 { // Ztarknet (0x999999 = 10066329 in decimal)
			// Get Ztarknet user address
			ztarknetUserAddr := envutil.GetZtarknetAliceAddress()
			if ztarknetUserAddr != "" {
				// Convert Ztarknet address to bytes32 (it's already 32 bytes)
				ztarknetBytes := hexToBytes32(ztarknetUserAddr)
				copy(recipientBytes[:], ztarknetBytes[:])
			} else {
				copy(recipientBytes[12:], userAddr.Bytes()) // Fallback to EVM address
			}
		} else {
			copy(recipientBytes[12:], userAddr.Bytes()) // Self-transfer for EVM→EVM
		}
	}

	// Extract amounts from MaxSpent and MinReceived arrays
	var amountIn, amountOut = big.NewInt(0), big.NewInt(0)

	// For ABI encoding, we need to use the origin chain tokens
	// since the order is processed on the origin chain
	// But the amounts come from the order data

	// Get amount from MinReceived (what Alice provides = AmountIn)
	if len(orderData.MinReceived) > 0 {
		amountIn = orderData.MinReceived[0].Amount.ToBig()
	}

	// Get amount from MaxSpent (what Alice receives = AmountOut)
	if len(orderData.MaxSpent) > 0 {
		amountOut = orderData.MaxSpent[0].Amount.ToBig()
	}

	// For ABI encoding, we need to set the correct token addresses
	originChainID := orderData.OriginChainID.Uint64()
	destinationChainID := orderData.DestinationChainID.Uint64()

	var originTokenAddr, destinationTokenAddr string

	// Find the origin network config to get the input token address
	for _, network := range networks {
		if network.chainID == originChainID {
			originTokenAddr = network.dogCoinAddress
			break
		}
	}

	// Find the destination network config to get the output token address
	for _, network := range networks {
		if network.chainID == destinationChainID {
			destinationTokenAddr = network.dogCoinAddress
			break
		}
	}

	// Special handling for Starknet/Ztarknet destinations - need to get from environment
	if destinationChainID == config.StarknetSepoliaChainID { // Starknet
		starknetDogCoin := os.Getenv("STARKNET_DOG_COIN_ADDRESS")
		if starknetDogCoin != "" {
			destinationTokenAddr = starknetDogCoin
		}
	} else if destinationChainID == config.ZtarknetTestnetChainID { // Ztarknet (0x999999 = 10066329 in decimal)
		ztarknetDogCoin := os.Getenv("ZTARKNET_DOG_COIN_ADDRESS")
		if ztarknetDogCoin != "" {
			destinationTokenAddr = ztarknetDogCoin
		}
	}

	// Set InputToken (origin chain token - what Alice locks up)
	if originTokenAddr != "" {
		inputTokenBytes = hexToBytes32(originTokenAddr)
	}

	// Set OutputToken (destination chain token - what solver provides to Alice)
	if destinationTokenAddr != "" {
		outputTokenBytes = hexToBytes32(destinationTokenAddr)
	}

	// Set destination settler address (Hyperlane contract on destination chain)
	// This should be the Hyperlane contract address for the destination domain
	if orderData.DestinationChainID.Uint64() == config.StarknetSepoliaChainID { // Starknet
		// Use Starknet Hyperlane address from environment
		starknetHyperlaneAddr := os.Getenv("STARKNET_HYPERLANE_ADDRESS")
		if starknetHyperlaneAddr != "" {
			starknetBytes := hexToBytes32(starknetHyperlaneAddr)
			copy(destinationSettlerBytes[:], starknetBytes[:])
		} else {
			// Fallback to zero address
			copy(destinationSettlerBytes[:], make([]byte, 32))
		}
		} else if orderData.DestinationChainID.Uint64() == config.ZtarknetTestnetChainID { // Ztarknet (0x999999 = 10066329 in decimal)
		// Use Ztarknet Hyperlane address from environment
		ztarknetHyperlaneAddr := os.Getenv("ZTARKNET_HYPERLANE_ADDRESS")
		if ztarknetHyperlaneAddr != "" {
			ztarknetBytes := hexToBytes32(ztarknetHyperlaneAddr)
			copy(destinationSettlerBytes[:], ztarknetBytes[:])
		} else {
			// Fallback to zero address
			copy(destinationSettlerBytes[:], make([]byte, 32))
		}
	} else {
		// EVM Hyperlane address
		destinationSettlerAddr := common.HexToAddress("0xf614c6bF94b022E16BEF7dBecF7614FFD2b201d3")
		copy(destinationSettlerBytes[12:], destinationSettlerAddr.Bytes()) // Left-pad to 32 bytes
	}

	return ABIOrderData{
		Sender:             senderBytes,
		Recipient:          recipientBytes,
		InputToken:         inputTokenBytes,
		OutputToken:        outputTokenBytes,
		AmountIn:           amountIn,
		AmountOut:          amountOut,
		SenderNonce:        senderNonce, // Use actual nonce from parameter
		OriginDomain:       uint32(orderData.OriginChainID.Uint64()),
		DestinationDomain:  uint32(orderData.DestinationChainID.Uint64()),
		DestinationSettler: destinationSettlerBytes,
		FillDeadline:       uint32(orderData.FillDeadline.Uint64()),
		Data:               []byte{}, // Empty data for now
	}
}

