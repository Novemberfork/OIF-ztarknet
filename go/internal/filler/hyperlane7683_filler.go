package filler

import (
	"context"
	"fmt"
	"math/big"

	"github.com/NethermindEth/oif-starknet/go/internal/types"
)

// Hyperlane7683Filler implements BaseFiller for Hyperlane7683 intents
type Hyperlane7683Filler struct {
	*BaseFillerImpl
	metadata types.Hyperlane7683Metadata
}

// NewHyperlane7683Filler creates a new Hyperlane7683 filler
func NewHyperlane7683Filler(allowBlockLists types.AllowBlockLists, metadata types.Hyperlane7683Metadata) *Hyperlane7683Filler {
	baseFiller := NewBaseFiller(allowBlockLists, metadata)
	
	return &Hyperlane7683Filler{
		BaseFillerImpl: baseFiller,
		metadata:       metadata,
	}
}

// Fill executes the actual intent filling
func (f *Hyperlane7683Filler) Fill(ctx context.Context, args types.ParsedArgs, data types.IntentData, originChainName string, blockNumber uint64) error {
	// For now, this is a mock implementation that logs the intent
	// In the real implementation, this would:
	// 1. Check balances on destination chains
	// 2. Execute the fill instructions
	// 3. Submit transactions to fill the intent
	
	fmt.Printf("🔵 Filling Intent: %s-%s on chain %s (block %d)\n", 
		f.metadata.ProtocolName, args.OrderID, originChainName, blockNumber)
	
	fmt.Printf("   Fill Instructions: %x\n", data.FillInstructions)
	fmt.Printf("   Max Spent: %d tokens\n", len(data.MaxSpent))
	
	// Simulate some processing time
	// In real implementation, this would be actual blockchain transactions
	
	return nil
}

// SettleOrder handles post-fill settlement
func (f *Hyperlane7683Filler) SettleOrder(ctx context.Context, args types.ParsedArgs, data types.IntentData, originChainName string) error {
	// For now, this is a mock implementation
	// In the real implementation, this would:
	// 1. Update internal state
	// 2. Record the filled intent
	// 3. Handle any post-fill logic
	
	fmt.Printf("✅ Settled Order: %s-%s on chain %s\n", 
		f.metadata.ProtocolName, args.OrderID, originChainName)
	
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
	// For now, this is a simplified implementation
	// In the real implementation, this would:
	// 1. Check token amounts against configured thresholds
	// 2. Filter based on chain-specific rules
	// 3. Apply allow/block logic
	
	// Simulate checking amounts
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
func (f *Hyperlane7683Filler) intentNotFilled(args types.ParsedArgs, context *FillerContext) error {
	// For now, this is a mock implementation
	// In the real implementation, this would:
	// 1. Check database for existing fills
	// 2. Verify intent status on-chain
	// 3. Prevent duplicate processing
	
	fmt.Printf("   🔍 Checking if intent %s is already filled...\n", args.OrderID)
	
	// Simulate checking - always allow for now
	fmt.Printf("   ✅ Intent %s is not filled, proceeding\n", args.OrderID)
	
	return nil
}
