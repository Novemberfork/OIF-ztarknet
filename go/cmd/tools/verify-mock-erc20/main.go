package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"

	"github.com/joho/godotenv"
)

// NetworkInfo contains information needed for contract verification
type NetworkInfo struct {
	Name           string
	ContractAddr   string
	ForgeNetwork   string
	ExplorerName   string
	ExplorerURL    string
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Fatal("Error loading .env file")
	}

	// Define networks and their MockERC20 contract addresses
	networks := []NetworkInfo{
		{
			Name:           "Ethereum Sepolia",
			ContractAddr:   os.Getenv("ETHEREUM_DOG_COIN_ADDRESS"),
			ForgeNetwork:   "11155111", // Sepolia chain ID
			ExplorerName:   "Etherscan",
			ExplorerURL:    "https://sepolia.etherscan.io/address/",
		},
		{
			Name:           "Optimism Sepolia",
			ContractAddr:   os.Getenv("OPTIMISM_DOG_COIN_ADDRESS"),
			ForgeNetwork:   "11155420", // OP Sepolia chain ID
			ExplorerName:   "Optimistic Etherscan",
			ExplorerURL:    "https://sepolia-optimism.etherscan.io/address/",
		},
		{
			Name:           "Arbitrum Sepolia",
			ContractAddr:   os.Getenv("ARBITRUM_DOG_COIN_ADDRESS"),
			ForgeNetwork:   "421614", // Arbitrum Sepolia chain ID
			ExplorerName:   "Arbiscan",
			ExplorerURL:    "https://sepolia.arbiscan.io/address/",
		},
		{
			Name:           "Base Sepolia",
			ContractAddr:   os.Getenv("BASE_DOG_COIN_ADDRESS"),
			ForgeNetwork:   "84532", // Base Sepolia chain ID
			ExplorerName:   "Basescan",
			ExplorerURL:    "https://sepolia.basescan.org/address/",
		},
	}

	// Check if specific network was requested
	var targetNetworks []NetworkInfo
	if len(os.Args) > 1 {
		networkName := strings.ToLower(os.Args[1])
		found := false
		for _, network := range networks {
			if strings.Contains(strings.ToLower(network.Name), networkName) {
				targetNetworks = []NetworkInfo{network}
				found = true
				break
			}
		}
		if !found {
			log.Fatalf("Invalid network name: %s. Available: ethereum, optimism, arbitrum, base", os.Args[1])
		}
	} else {
		targetNetworks = networks
	}

	fmt.Printf("🔍 Verifying MockERC20 contracts on %d network(s)...\n\n", len(targetNetworks))

	successCount := 0
	for _, network := range targetNetworks {
		if network.ContractAddr == "" {
			fmt.Printf("❌ %s: No contract address found in environment\n", network.Name)
			continue
		}

		// Extract just the address without comments
		contractAddr := strings.Split(network.ContractAddr, " ")[0]
		
		fmt.Printf("🚀 Verifying on %s...\n", network.Name)
		fmt.Printf("   📍 Contract: %s\n", contractAddr)
		fmt.Printf("   🌐 Explorer: %s%s\n", network.ExplorerURL, contractAddr)

		if err := verifyContract(network.ForgeNetwork, contractAddr); err != nil {
			fmt.Printf("   ❌ Verification failed: %v\n\n", err)
		} else {
			fmt.Printf("   ✅ Verification successful!\n")
			fmt.Printf("   🔗 View on %s: %s%s\n\n", network.ExplorerName, network.ExplorerURL, contractAddr)
			successCount++
		}
	}

	fmt.Printf("🎯 Verification Summary:\n")
	fmt.Printf("   ✅ Successful: %d/%d\n", successCount, len(targetNetworks))
	if successCount < len(targetNetworks) {
		fmt.Printf("   ❌ Failed: %d/%d\n", len(targetNetworks)-successCount, len(targetNetworks))
		fmt.Printf("\n💡 Note: Some failures may be due to contracts already being verified\n")
	}

	if successCount == len(targetNetworks) {
		fmt.Printf("\n🎉 All MockERC20 contracts verified successfully!\n")
	}
}

func verifyContract(forgeNetwork, contractAddress string) error {
	// Change to solidity directory where foundry.toml is located
	solidityDir := "../solidity"
	
	// Determine the correct API key environment variable name
	var apiKeyEnvVar string
	switch forgeNetwork {
	case "11155111": // Sepolia
		apiKeyEnvVar = "API_KEY_ETHERSCAN"
	case "11155420": // OP Sepolia
		apiKeyEnvVar = "API_KEY_OPTIMISTIC_ETHERSCAN"
	case "421614": // Arbitrum Sepolia
		apiKeyEnvVar = "API_KEY_ARBISCAN"
	case "84532": // Base Sepolia
		apiKeyEnvVar = "API_KEY_BASESCAN"
	default:
		return fmt.Errorf("unsupported chain ID: %s", forgeNetwork)
	}
	
	// Get the API key from environment
	apiKey := os.Getenv(apiKeyEnvVar)
	if apiKey == "" || apiKey == "YourEtherscanAPIKeyHere" || apiKey == "YourOptimisticEtherscanAPIKeyHere" || 
	   apiKey == "YourArbiscanAPIKeyHere" || apiKey == "YourBasescanAPIKeyHere" {
		fmt.Printf("   ⚠️  No valid API key found for %s\n", apiKeyEnvVar)
		fmt.Printf("   💡 Using Sourcify (free but may have metadata issues)\n")
		apiKey = "" // Force Sourcify usage
	} else {
		fmt.Printf("   🔑 Using %s API key for verification...\n", apiKeyEnvVar)
	}
	
	// Build the forge verify-contract command with compiler settings that match deployment
	var cmd *exec.Cmd
	if apiKey != "" {
		// Use Etherscan-compatible API with API key and exact Forge settings
		cmd = exec.Command("forge", "verify-contract",
			contractAddress,
			"src/MockERC20.sol:MockERC20",
			"--chain", forgeNetwork,
			"--etherscan-api-key", apiKey,
			"--compiler-version", "0.8.25",
			"--optimizer-runs", "10000",
			"--watch",
		)
	} else {
		// Fall back to Sourcify with compiler settings
		cmd = exec.Command("forge", "verify-contract",
			contractAddress,
			"src/MockERC20.sol:MockERC20",
			"--chain", forgeNetwork,
			"--compiler-version", "0.8.25",
			"--optimizer-runs", "10000",
			"--watch",
		)
	}
	
	// Set working directory to solidity folder
	cmd.Dir = solidityDir
	
	// Capture output
	output, err := cmd.CombinedOutput()
	outputStr := string(output)
	
	if err != nil {
		// Check if it's already verified
		if strings.Contains(outputStr, "already verified") || 
		   strings.Contains(outputStr, "Already Verified") ||
		   strings.Contains(outputStr, "Contract source code already verified") ||
		   strings.Contains(outputStr, "already been verified") ||
		   strings.Contains(outputStr, "ALREADY_VERIFIED") {
			fmt.Printf("   ✅ Contract already verified\n")
			return nil
		}
		
		// Check if it's an API key issue
		if strings.Contains(outputStr, "Invalid API Key") || 
		   strings.Contains(outputStr, "API key") || 
		   strings.Contains(outputStr, "rate limit") ||
		   strings.Contains(outputStr, "unauthorized") {
			fmt.Printf("   ⚠️  Invalid or missing API key\n")
			fmt.Printf("   💡 Get a free API key from:\n")
			switch forgeNetwork {
			case "11155111": // Sepolia
				fmt.Printf("      - Etherscan: https://etherscan.io/apis\n")
			case "11155420": // OP Sepolia
				fmt.Printf("      - Optimistic Etherscan: https://optimistic.etherscan.io/apis\n")
			case "421614": // Arbitrum Sepolia
				fmt.Printf("      - Arbiscan: https://arbiscan.io/apis\n")
			case "84532": // Base Sepolia
				fmt.Printf("      - Basescan: https://basescan.org/apis\n")
			}
			fmt.Printf("   📝 Then update the real API key in your .env file\n")
			return fmt.Errorf("invalid API key for chain %s", forgeNetwork)
		}
		
		return fmt.Errorf("forge command failed: %v\nOutput: %s", err, output)
	}
	
	return nil
}
