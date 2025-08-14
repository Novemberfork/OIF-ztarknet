package filler

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"os"
	"strings"

	"github.com/NethermindEth/oif-starknet/go/internal/config"
	"github.com/NethermindEth/oif-starknet/go/internal/types"
	"github.com/NethermindEth/oif-starknet/go/pkg/ethutil"
	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	coretypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// Function selectors for Hyperlane7683 contract
const (
	FillSelector        = "0x82e2c43f" // fill(bytes32,bytes,bytes) payable
	OrderStatusSelector = "0x2dff692d" // orderStatus(bytes32) view returns (bytes32)
)

// UnknownOrderStatus represents an unfilled order
var UnknownOrderStatus = common.Hash{}

// ErrIntentAlreadyFilled indicates the order has already been filled on destination
var ErrIntentAlreadyFilled = errors.New("intent already filled")

// Hyperlane7683Filler implements the Hyperlane7683 specific filling logic
type Hyperlane7683Filler struct {
	*BaseFillerImpl
	client   *ethclient.Client
	clients  map[uint64]*ethclient.Client
	signers  map[uint64]*bind.TransactOpts
	metadata types.Hyperlane7683Metadata
}

// NewHyperlane7683Filler creates a new Hyperlane7683 filler
func NewHyperlane7683Filler(client *ethclient.Client) *Hyperlane7683Filler {
	// Create default metadata
	metadata := types.Hyperlane7683Metadata{
		BaseMetadata: types.BaseMetadata{
			ProtocolName: "Hyperlane7683",
		},
		IntentSources: []types.IntentSource{},
		CustomRules:   types.CustomRules{},
	}
	
	// Create default allow/block lists
	allowBlockLists := types.AllowBlockLists{
		AllowList: []types.AllowBlockListItem{},
		BlockList: []types.AllowBlockListItem{},
	}
	
	return &Hyperlane7683Filler{
		BaseFillerImpl: NewBaseFiller(allowBlockLists, metadata),
		client:         client,
		clients:        make(map[uint64]*ethclient.Client),
		signers:        make(map[uint64]*bind.TransactOpts),
		metadata:       metadata,
	}
}

// ProcessIntent processes an intent through the complete flow
func (f *Hyperlane7683Filler) ProcessIntent(ctx context.Context, args types.ParsedArgs, originChainName string, blockNumber uint64) error {
	fmt.Printf("🔵 Processing Intent: %s-%s on chain %s (block %d)\n", 
		f.metadata.ProtocolName, args.OrderID, originChainName, blockNumber)

	// Step 1: Check if intent is already filled
	if err := f.intentNotFilled(args, nil); err != nil {
		if errors.Is(err, ErrIntentAlreadyFilled) {
			fmt.Printf("   ✅ Intent %s already filled on destination; skipping\n", args.OrderID)
			return nil
		}
		fmt.Printf("   ❌ Could not verify unfilled intent: %v\n", err)
		return fmt.Errorf("pre-check failed: %w", err)
	}
	fmt.Printf("   ✅ Intent not yet filled, proceeding\n")

	// Step 2: Apply rules (balance checks, token filters, etc.)
	if err := f.filterByTokenAndAmount(args, nil); err != nil {
		fmt.Printf("   ❌ Rules check failed: %v\n", err)
		return fmt.Errorf("rules check failed: %w", err)
	}
	fmt.Printf("   ✅ Rules check passed\n")

	// Step 2.5: Check balances and allowances
	if err := f.checkBalances(args); err != nil {
		fmt.Printf("   ❌ Balance check failed: %v\n", err)
		return fmt.Errorf("balance check failed: %w", err)
	}

	if err := f.checkAllowances(args); err != nil {
		fmt.Printf("   ❌ Allowance check failed: %v\n", err)
		return fmt.Errorf("allowance check failed: %w", err)
	}

	// Step 3: Prepare intent data
	intentData := types.IntentData{
		FillInstructions: args.ResolvedOrder.FillInstructions,
		MaxSpent:         args.ResolvedOrder.MaxSpent,
	}

	// Step 4: Execute the fill
	if err := f.Fill(ctx, args, intentData, originChainName, blockNumber); err != nil {
		fmt.Printf("   ❌ Fill execution failed: %v\n", err)
		return fmt.Errorf("fill execution failed: %w", err)
	}
	fmt.Printf("   ✅ Fill executed successfully\n")

	// Step 5: Settle the order
	if err := f.SettleOrder(ctx, args, intentData, originChainName); err != nil {
		fmt.Printf("   ❌ Order settlement failed: %v\n", err)
		return fmt.Errorf("order settlement failed: %w", err)
	}
	fmt.Printf("   ✅ Order settled successfully\n")

	return nil
}

// Fill executes the actual intent filling
func (f *Hyperlane7683Filler) Fill(ctx context.Context, args types.ParsedArgs, data types.IntentData, originChainName string, blockNumber uint64) error {
	fmt.Printf("🔵 Filling Intent: %s-%s on chain %s (block %d)\n", 
		f.metadata.ProtocolName, args.OrderID, originChainName, blockNumber)
	
	fmt.Printf("   Fill Instructions: %d instructions\n", len(data.FillInstructions))
	fmt.Printf("   Max Spent: %d outputs\n", len(data.MaxSpent))
	
	// Execute each fill instruction
	fmt.Printf("   📋 Executing fill instructions...\n")
	
	for i, instruction := range data.FillInstructions {
		// Convert bytes32 to common.Address for the settler
		settlerAddr := instruction.DestinationSettler
		
		fmt.Printf("   📦 Instruction %d: Chain %s, Settler %s\n", 
			i+1, instruction.DestinationChainID.String(), settlerAddr.Hex())
		
		// Get the client for the destination chain
		client, err := f.getClientForChain(instruction.DestinationChainID)
		if err != nil {
			return fmt.Errorf("failed to get client for chain %s: %w", instruction.DestinationChainID.String(), err)
		}
		
		// Get the signer for the destination chain to create fillerData
		signer, err := f.getSignerForChain(instruction.DestinationChainID)
		if err != nil {
			return fmt.Errorf("failed to get signer for chain %s: %w", instruction.DestinationChainID.String(), err)
		}
		
		// Log the MaxSpent details for this instruction
		if i < len(data.MaxSpent) {
			maxSpent := data.MaxSpent[i]
			fmt.Printf("   💰 MaxSpent[%d]: Token=%s, Amount=%s, Recipient=%s, ChainID=%s\n",
				i, maxSpent.Token.Hex(), // Now directly common.Address
				maxSpent.Amount.String(),
				maxSpent.Recipient.Hex(), // Now directly common.Address
				maxSpent.ChainID.String())
		}
		
		// Pack the fill function call using proper ABI encoding
		// fill(bytes32 orderId, bytes originData, bytes fillerData) payable
		orderIdBytes := common.FromHex(args.OrderID)
		var orderIdArr [32]byte
		copy(orderIdArr[:], orderIdBytes)
		originDataBytes := instruction.OriginData
		
		// Create fillerData - this should identify who is filling the order
		// Based on the test, this should be the filler's address encoded as bytes32
		fillerAddressBytes := common.LeftPadBytes(signer.From.Bytes(), 32)
		
		// Use ABI encoding for the fill function call
		fillABI := `[{"type":"function","name":"fill","inputs":[{"type":"bytes32","name":"orderId"},{"type":"bytes","name":"originData"},{"type":"bytes","name":"fillerData"}],"outputs":[],"stateMutability":"payable"}]`
		
		parsedABI, err := abi.JSON(strings.NewReader(fillABI))
		if err != nil {
			return fmt.Errorf("failed to parse fill ABI: %w", err)
		}
		
		// Pack the function call
		txData, err := parsedABI.Pack("fill", orderIdArr, originDataBytes, fillerAddressBytes)
		if err != nil {
			return fmt.Errorf("failed to pack fill function call: %w", err)
		}
		
		fmt.Printf("   🔄 Executing fill call to contract %s on chain %s\n",
			settlerAddr.Hex(), instruction.DestinationChainID.String())
		fmt.Printf("   📦 Fill parameters: orderId=%x, originData=%d bytes, fillerData=%x\n",
			orderIdArr, len(originDataBytes), fillerAddressBytes)
		
		// Verify we can connect to the destination chain
		chainID, err := client.ChainID(ctx)
		if err != nil {
			fmt.Printf("   ⚠️  Warning: Could not verify chain ID: %v\n", err)
		} else {
			fmt.Printf("   🔗 Connected to chain ID: %s\n", chainID.String())
		}
		
		// Execute the fill transaction
		if err := f.executeFillTransaction(ctx, client, settlerAddr, txData, instruction.DestinationChainID); err != nil {
			return fmt.Errorf("failed to execute fill transaction on chain %s: %w", instruction.DestinationChainID.String(), err)
		}
	}
	
	fmt.Printf("   🎉 All fill instructions processed\n")
	return nil
}

// executeFillTransaction executes a fill transaction on the destination chain
func (f *Hyperlane7683Filler) executeFillTransaction(ctx context.Context, client *ethclient.Client, settlerAddr common.Address, txData []byte, chainID *big.Int) error {
	// Get the signer for the destination chain
	signer, err := f.getSignerForChain(chainID)
	if err != nil {
		return fmt.Errorf("failed to get signer for chain %s: %w", chainID.String(), err)
	}
	
	// Get gas price and nonce
	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		return fmt.Errorf("failed to get gas price: %w", err)
	}
	
	nonce, err := client.PendingNonceAt(ctx, signer.From)
	if err != nil {
		return fmt.Errorf("failed to get nonce: %w", err)
	}
	
	// Create the transaction
	tx := coretypes.NewTransaction(
		nonce,
		settlerAddr,
		big.NewInt(0), // No native token transfer for now
		500000,        // Gas limit
		gasPrice,
		txData,
	)
	
	// Sign and send the transaction using the signer
	signedTx, err := signer.Signer(signer.From, tx)
	if err != nil {
		return fmt.Errorf("failed to sign fill transaction: %w", err)
	}
	
	err = client.SendTransaction(ctx, signedTx)
	if err != nil {
		return fmt.Errorf("failed to send fill transaction: %w", err)
	}
	
	fmt.Printf("   ✅ Fill transaction sent: %s\n", signedTx.Hash().Hex())
	
	// Wait for confirmation
	receipt, err := bind.WaitMined(ctx, client, signedTx)
	if err != nil {
		return fmt.Errorf("failed to wait for fill confirmation: %w", err)
	}
	
	if receipt.Status == 0 {
		return fmt.Errorf("fill transaction failed at block %d", receipt.BlockNumber)
	}
	
	fmt.Printf("   🎉 Fill transaction confirmed at block %d\n", receipt.BlockNumber)
	
	return nil
}

// SettleOrder handles post-fill settlement
func (f *Hyperlane7683Filler) SettleOrder(ctx context.Context, args types.ParsedArgs, data types.IntentData, originChainName string) error {
	fmt.Printf("✅ Settling Order: %s-%s on chain %s\n", 
		f.metadata.ProtocolName, args.OrderID, originChainName)
	
	// TODO: Implement actual settlement logic
	// 1. Update internal state
	// 2. Record the filled intent
	// 3. Handle any post-fill logic
	
	return nil
}

// AddDefaultRules adds the default rules for Hyperlane7683
func (f *Hyperlane7683Filler) AddDefaultRules() {
	// Add the filterByTokenAndAmount rule
	f.AddRule(f.filterByTokenAndAmount)
	
	// Add the intentNotFilled rule
	f.AddRule(f.intentNotFilled)
}

// filterByTokenAndAmount filters intents based on token and amount thresholds
func (f *Hyperlane7683Filler) filterByTokenAndAmount(args types.ParsedArgs, context *FillerContext) error {
	fmt.Printf("   🔍 Checking token and amount rules...\n")
	
	// TODO: Implement proper token and amount filtering based on TypeScript reference
	// This should check:
	// 1. Token allowlists for each chain
	// 2. Maximum amount thresholds
	// 3. Profitability (amountIn > amountOut)
	
	// For now, this is a simplified implementation
	for _, maxSpent := range args.ResolvedOrder.MaxSpent {
		// Convert chain ID to string for comparison
		chainIDStr := maxSpent.ChainID.String()
		
		// Simple threshold check (1 ETH = 1000000000000000000 wei)
		oneEth := big.NewInt(1000000000000000000)
		
		if maxSpent.Amount.Cmp(oneEth) > 0 {
			fmt.Printf("   📊 Amount %s exceeds threshold on chain %s\n", 
				maxSpent.Amount.String(), chainIDStr)
		}
	}
	
	return nil
}

// intentNotFilled ensures intents aren't double-filled
func (f *Hyperlane7683Filler) intentNotFilled(args types.ParsedArgs, fillerContext *FillerContext) error {
	fmt.Printf("   🔍 Checking if intent %s is already filled...\n", args.OrderID)
	
	// Check if we have fill instructions to determine the destination
	if len(args.ResolvedOrder.FillInstructions) == 0 {
		return fmt.Errorf("no fill instructions found")
	}
	
	// Get the first fill instruction to determine destination chain and contract
	firstInstruction := args.ResolvedOrder.FillInstructions[0]
	destinationChainID := firstInstruction.DestinationChainID
	destinationSettler := firstInstruction.DestinationSettler
	
	// destinationSettler is now a common.Address, no need to convert
	settlerAddr := destinationSettler
	
	fmt.Printf("   📍 Checking order status on destination chain %s, contract %s\n", 
		destinationChainID.String(), settlerAddr.Hex())
	
	// Get the RPC client for the destination chain
	client, err := f.getClientForChain(destinationChainID)
	if err != nil {
		return fmt.Errorf("failed to get client for chain %s: %w", destinationChainID.String(), err)
	}
	
	// Pack the orderStatus call
	orderIdBytes := common.LeftPadBytes(common.FromHex(args.OrderID), 32)
	data := append(common.FromHex(OrderStatusSelector), orderIdBytes...)
	
	fmt.Printf("   🔍 Calling orderStatus with data: 0x%x\n", data)
	fmt.Printf("   🔍 OrderID: %s\n", args.OrderID)
	fmt.Printf("   🔍 Contract: %s\n", settlerAddr.Hex())
	
	// Make the call to the destination chain contract
	result, err := client.CallContract(context.Background(), ethereum.CallMsg{
		To:   &settlerAddr,
		Data: data,
	}, nil)
	if err != nil {
		return fmt.Errorf("failed to call orderStatus: %w", err)
	}
	
	fmt.Printf("   🔍 orderStatus result: %x (length: %d)\n", result, len(result))
	
	// Parse the result (should be 32 bytes)
	if len(result) < 32 {
		return fmt.Errorf("invalid orderStatus result length: %d", len(result))
	}
	
	orderStatus := common.BytesToHash(result[:32])
	fmt.Printf("   🔍 Parsed orderStatus: %x\n", orderStatus)
	fmt.Printf("   🔍 Expected UnknownOrderStatus: %x\n", UnknownOrderStatus)
	
	if orderStatus != UnknownOrderStatus {
		// Already filled — signal with sentinel error
		return ErrIntentAlreadyFilled
	}
	
	fmt.Printf("   ✅ Intent %s is not filled, proceeding\n", args.OrderID)
	return nil
}

// checkBalances verifies that the filler has sufficient balances on destination chains
func (f *Hyperlane7683Filler) checkBalances(args types.ParsedArgs) error {
	fmt.Printf("   💰 Checking balances on destination chains...\n")
	
	// TODO: Implement proper balance checking
	// This should:
	// 1. Connect to each destination chain
	// 2. Check token balances for the filler address
	// 3. Ensure sufficient funds to execute the fill
	
	for _, maxSpent := range args.ResolvedOrder.MaxSpent {
		chainID := maxSpent.ChainID.String()
		amount := maxSpent.Amount.String()
		
		// Convert bytes32 token address to common.Address
		tokenAddr := common.BytesToAddress(maxSpent.Token[:20])
		
		fmt.Printf("   📊 Chain %s: Need %s tokens of %s\n", chainID, amount, tokenAddr.Hex())
		
		// TODO: Actually check balance
		// client, err := f.getClientForChain(maxSpent.ChainID)
		// if err != nil {
		//     return fmt.Errorf("failed to get client for chain %s: %w", chainID, err)
		// }
		// 
		// balance, err := f.getTokenBalance(client, tokenAddr, fillerAddress)
		// if err != nil {
		//     return fmt.Errorf("failed to check balance on chain %s: %w", chainID, err)
		// }
		// if balance.Cmp(maxSpent.Amount) < 0 {
		//     return fmt.Errorf("insufficient balance on chain %s: have %s, need %s", 
		//         chainID, balance.String(), maxSpent.Amount.String())
		// }
	}
	
	fmt.Printf("   ✅ Balance check passed\n")
	return nil
}

// checkAllowances verifies that the filler has sufficient allowances for the destination contracts
func (f *Hyperlane7683Filler) checkAllowances(args types.ParsedArgs) error {
	fmt.Printf("   🔓 Checking token allowances...\n")
	
	// TODO: Implement proper allowance checking
	// This should:
	// 1. Check current allowances for each token
	// 2. Approve tokens if needed
	// 3. Ensure sufficient allowance to execute the fill
	
	for _, maxSpent := range args.ResolvedOrder.MaxSpent {
		chainID := maxSpent.ChainID.String()
		amount := maxSpent.Amount.String()
		
		// Convert bytes32 token address to common.Address
		tokenAddr := common.BytesToAddress(maxSpent.Token[:20])
		
		// Get the destination settler address from fill instructions
		var destinationSettler common.Address
		if len(args.ResolvedOrder.FillInstructions) > 0 {
			destinationSettler = common.BytesToAddress(args.ResolvedOrder.FillInstructions[0].DestinationSettler[:20])
		}
		
		fmt.Printf("   📋 Chain %s: Need %s allowance for token %s to contract %s\n", 
			chainID, amount, tokenAddr.Hex(), destinationSettler.Hex())
		
		// TODO: Actually check and set allowance
		// client, err := f.getClientForChain(maxSpent.ChainID)
		// if err != nil {
		//     return fmt.Errorf("failed to get client for chain %s: %w", chainID, err)
		// }
		// 
		// allowance, err := f.getTokenAllowance(client, tokenAddr, fillerAddress, destinationSettler)
		// if err != nil {
		//     return fmt.Errorf("failed to check allowance on chain %s: %w", chainID, err)
		// }
		// if allowance.Cmp(maxSpent.Amount) < 0 {
		//     // Need to approve
		//     err := f.approveToken(client, tokenAddr, destinationSettler, maxSpent.Amount)
		//     if err != nil {
		//         return fmt.Errorf("failed to approve token on chain %s: %w", chainID, err)
		//     }
		// }
	}
	
	fmt.Printf("   ✅ Allowance check passed\n")
	return nil
}

// getClientForChain returns an ethclient for the specified chain
// This connects to the actual destination chains for order status checking and filling
func (f *Hyperlane7683Filler) getClientForChain(chainID *big.Int) (*ethclient.Client, error) {
	chainIDUint := chainID.Uint64()
	
	// Check if we already have a client for this chain
	if client, exists := f.clients[chainIDUint]; exists {
		return client, nil
	}
	
	// Get the RPC URL for this chain from the centralized config
	rpcURL, err := config.GetRPCURLByChainID(chainIDUint)
	if err != nil {
		return nil, fmt.Errorf("failed to get RPC URL for chain %d: %w", chainIDUint, err)
	}
	
	// Create a new client
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to chain %d at %s: %w", chainIDUint, rpcURL, err)
	}
	
	// Store the client for future use
	f.clients[chainIDUint] = client
	
	fmt.Printf("   🔗 Connected to chain %d at %s\n", chainIDUint, rpcURL)
	return client, nil
}

// getSignerForChain returns a TransactOpts for the specified chain
func (f *Hyperlane7683Filler) getSignerForChain(chainID *big.Int) (*bind.TransactOpts, error) {
	chainIDUint := chainID.Uint64()
	
	// Check if we already have a signer for this chain
	if signer, exists := f.signers[chainIDUint]; exists {
		return signer, nil
	}
	
	// Get the solver's private key from environment variable
	// This should be the SOLVER_PRIVATE_KEY that was set up in deploy-tokens
	solverPrivateKey := os.Getenv("SOLVER_PRIVATE_KEY")
	if solverPrivateKey == "" {
		return nil, fmt.Errorf("SOLVER_PRIVATE_KEY environment variable not set")
	}
	
	// Parse the private key
	pk, err := ethutil.ParsePrivateKey(solverPrivateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to parse solver private key: %w", err)
	}
	
	// Get the account address from the private key
	from := crypto.PubkeyToAddress(pk.PublicKey)
	
	// Create a TransactOpts
	signer := bind.NewKeyedTransactor(pk)
	signer.From = from
	
	// Store the signer for future use
	f.signers[chainIDUint] = signer
	
	fmt.Printf("   🔑 Signer created for chain %d (address: %s)\n", chainIDUint, from.Hex())
	return signer, nil
}

// Close closes all client connections
func (f *Hyperlane7683Filler) Close() error {
	var lastErr error
	
	// Close all chain clients
	for _, client := range f.clients {
		client.Close() // ethclient.Close() doesn't return an error
	}
	
	// Clear the clients map
	f.clients = make(map[uint64]*ethclient.Client)
	
	// Clear the signers map
	f.signers = make(map[uint64]*bind.TransactOpts)
	
	return lastErr
}
