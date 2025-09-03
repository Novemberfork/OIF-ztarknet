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
	// Run the Starknet order creation logic with default command
	RunStarknetOrder("default")
}

func runEVMOrder() {
	// Run the EVM order creation logic with default command
	RunEVMOrder("default-evm-evm")
}
