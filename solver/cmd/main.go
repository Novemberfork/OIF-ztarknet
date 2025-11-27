package main

// Main entry point for the OIF Starknet solver
// Provides a single binary with CLI routing to different tools

import (
	"fmt"
	"os"
	"strings"

	"github.com/NethermindEth/oif-starknet/solver/cmd/solver"
	openorder "github.com/NethermindEth/oif-starknet/solver/cmd/tools/open-order"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "solver":
		// Run the main solver
		runSolver()
	case "tools":
		// Route to development tools
		runTools()
	case "help", "-h", "--help":
		printUsage()
	default:
		fmt.Printf("Unknown command: %s\n", command)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("OIF Starknet Solver - Single Binary for All Operations")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  solver <command> [options]")
	fmt.Println()
	fmt.Println("Commands:")
	fmt.Println("  solver                    Run the main solver")
	fmt.Println("  tools <tool> [options]    Run development tools")
	fmt.Println("  help                      Show this help message")
	fmt.Println()
	fmt.Println("Development Tools:")
	fmt.Println("  tools open-order <chain>  Create test orders (starknet|ztarknet|evm)")
	fmt.Println("  tools setup-forks <cmd>   Setup forked networks")
	fmt.Println()
	fmt.Println("Examples:")
	fmt.Println("  solver solver                    # Run main solver")
	fmt.Println("  solver tools open-order starknet # Create Starknet order")
	fmt.Println("  solver tools open-order ztarknet # Create Ztarknet order")
	fmt.Println("  solver tools open-order evm      # Create EVM order")
	fmt.Println("  solver tools setup-forks deploy  # Deploy to forks")
}

func runSolver() {
	// Run the main solver
	solver.RunSolver()
}

func runTools() {
	if len(os.Args) < 3 {
		fmt.Println("Usage: solver tools <tool> [options]")
		fmt.Println("Available tools: open-order, setup-forks")
		os.Exit(1)
	}

	tool := os.Args[2]

	switch tool {
	case "open-order":
		runOpenOrder()
	case "setup-forks":
		runSetupForks()
	default:
		fmt.Printf("Unknown tool: %s\n", tool)
		fmt.Println("Available tools: open-order, setup-forks")
		os.Exit(1)
	}
}

func runOpenOrder() {
	if len(os.Args) < 4 {
		fmt.Println("Usage: solver tools open-order <origin> [destination]")
		fmt.Println("Available origins: evm, starknet (strk), ztarknet (ztrk), or specific chain names")
		fmt.Println("Available destinations: evm, starknet (strk), ztarknet (ztrk), or specific chain names")
		fmt.Println("  - If destination is omitted, a random valid destination will be selected")
		fmt.Println("  - 'evm' as origin/destination means any EVM chain (Ethereum, Optimism, Arbitrum, Base)")
		fmt.Println("  - Origin and destination cannot be the same")
		fmt.Println()
		fmt.Println("Examples:")
		fmt.Println("  solver tools open-order evm              # EVM → random destination")
		fmt.Println("  solver tools open-order evm starknet    # EVM → Starknet")
		fmt.Println("  solver tools open-order starknet evm    # Starknet → EVM")
		fmt.Println("  solver tools open-order ztarknet starknet # Ztarknet → Starknet")
		fmt.Println("  solver tools open-order ethereum base   # Ethereum → Base")
		os.Exit(1)
	}

	// Get origin chain
	originChain, err := openorder.GetOriginFromArgs(os.Args, 3)
	if err != nil {
		fmt.Printf("❌ Error getting origin: %v\n", err)
		os.Exit(1)
	}

	// Get destination chain (optional)
	destinationChain, err := openorder.GetDestinationFromArgs(originChain, os.Args, 4)
	if err != nil {
		fmt.Printf("❌ Error getting destination: %v\n", err)
		os.Exit(1)
	}

	// Determine network type and route to appropriate handler
	originType := openorder.GetNetworkType(originChain)
	
	switch originType {
	case openorder.NetworkTypeStarknet:
		// For Starknet, we need to construct a command string
		command := "custom"
		openorder.RunStarknetOrderWithDest(command, originChain, destinationChain)
	case openorder.NetworkTypeZtarknet:
		// For Ztarknet, we need to construct a command string
		command := "custom"
		openorder.RunZtarknetOrderWithDest(command, originChain, destinationChain)
	case openorder.NetworkTypeEVM:
		// For EVM, we need to construct a command string
		command := "custom"
		openorder.RunEVMOrderWithDest(command, originChain, destinationChain)
	default:
		fmt.Printf("❌ Unknown origin network type: %s\n", originChain)
		os.Exit(1)
	}
}

func runSetupForks() {
	if len(os.Args) < 4 {
		fmt.Println("Usage: solver tools setup-forks <command>")
		fmt.Println("Available commands: deploy, declare, verify")
		os.Exit(1)
	}

	cmd := os.Args[3]

	switch strings.ToLower(cmd) {
	case "deploy":
		fmt.Println("🔧 Running fork deployment...")
		// This will call the deployment logic
	case "declare":
		fmt.Println("🔧 Running contract declaration...")
		// This will call the declaration logic
	case "verify":
		fmt.Println("🔧 Running deployment verification...")
		// This will call the verification logic
	default:
		fmt.Printf("Unknown setup command: %s\n", cmd)
		fmt.Println("Available commands: deploy, declare, verify")
		os.Exit(1)
	}
}
