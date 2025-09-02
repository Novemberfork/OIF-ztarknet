package openorder

// OpenOrder package - contains the order creation logic
// This allows the order creation tools to be imported and run from the main CLI

import (
	"fmt"
	"os"
	"strings"
)

// RunOpenOrder runs the order creation tool
func RunOpenOrder(chain string) {
	switch strings.ToLower(chain) {
	case "starknet":
		fmt.Println("🎯 Running Starknet order creation...")
		// This will call the Starknet order creation logic
		runStarknetOrder()
	case "evm":
		fmt.Println("🎯 Running EVM order creation...")
		// This will call the EVM order creation logic
		runEVMOrder()
	default:
		fmt.Printf("Unknown chain: %s\n", chain)
		fmt.Println("Available chains: starknet, evm")
		os.Exit(1)
	}
}

func runStarknetOrder() {
	// Import and run the Starknet order creation logic
	// This will be implemented by moving the Starknet order logic here
	fmt.Println("   📝 Creating Starknet order...")
	fmt.Println("   (Starknet order logic will be integrated here)")
}

func runEVMOrder() {
	// Import and run the EVM order creation logic
	// This will be implemented by moving the EVM order logic here
	fmt.Println("   📝 Creating EVM order...")
	fmt.Println("   (EVM order logic will be integrated here)")
}
