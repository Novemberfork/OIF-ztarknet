package openorder

// Shared helper functions for order creation across all network types

import (
	"fmt"
	"strings"

	"github.com/NethermindEth/oif-starknet/solver/solvercore/config"
)

// NetworkType represents the type of network
type NetworkType string

const (
	NetworkTypeEVM     NetworkType = "evm"
	NetworkTypeStarknet NetworkType = "starknet"
	NetworkTypeZtarknet NetworkType = "ztarknet"
)

// GetNetworkType determines the network type from a network name
func GetNetworkType(networkName string) NetworkType {
	lowerName := strings.ToLower(networkName)
	if strings.Contains(lowerName, "ztarknet") {
		return NetworkTypeZtarknet
	}
	if strings.Contains(lowerName, "starknet") {
		return NetworkTypeStarknet
	}
	return NetworkTypeEVM
}

// GetRandomDestination gets a random destination chain, excluding the origin
// Supports all network types: evm, starknet, ztarknet
func GetRandomDestination(originChain string) (string, error) {
	allNetworks := config.GetNetworkNames()
	originType := GetNetworkType(originChain)

	var validDestinations []string
	for _, networkName := range allNetworks {
		// Skip the origin chain
		if networkName == originChain {
			continue
		}

		destType := GetNetworkType(networkName)

		// For EVM origins: can go to any EVM chain or any Starknet-type chain
		if originType == NetworkTypeEVM {
			validDestinations = append(validDestinations, networkName)
		} else if originType == NetworkTypeStarknet {
			// For Starknet origins: can go to any EVM chain or Ztarknet
			if destType == NetworkTypeEVM || destType == NetworkTypeZtarknet {
				validDestinations = append(validDestinations, networkName)
			}
		} else if originType == NetworkTypeZtarknet {
			// For Ztarknet origins: can go to any EVM chain or Starknet
			if destType == NetworkTypeEVM || destType == NetworkTypeStarknet {
				validDestinations = append(validDestinations, networkName)
			}
		}
	}

	if len(validDestinations) == 0 {
		return "", fmt.Errorf("no valid destinations found for origin %s", originChain)
	}

	// Select random destination
	destIdx := secureRandomInt(len(validDestinations))
	return validDestinations[destIdx], nil
}

// GetDestinationFromArgs gets destination from args, or random if not provided
func GetDestinationFromArgs(originChain string, args []string, argIndex int) (string, error) {
	if len(args) > argIndex && args[argIndex] != "" {
		destChain := args[argIndex]
		destNormalized := normalizeChainName(destChain)
		
		// Handle "evm" as destination - pick a random EVM chain (different from origin)
		if destNormalized == "evm" {
			allNetworks := config.GetNetworkNames()
			var evmNetworks []string
			
			for _, networkName := range allNetworks {
				netType := GetNetworkType(networkName)
				// Skip origin chain (compare actual names, not normalized)
				if networkName == originChain {
					continue
				}
				if netType == NetworkTypeEVM {
					evmNetworks = append(evmNetworks, networkName)
				}
			}
			
			if len(evmNetworks) == 0 {
				return "", fmt.Errorf("no EVM networks available as destination (all EVM chains are the same as origin)")
			}
			
			idx := secureRandomInt(len(evmNetworks))
			return evmNetworks[idx], nil
		}
		
		// Map aliases to actual network names first
		var actualDestChain string
		if destNormalized == "starknet" || destNormalized == "strk" {
			actualDestChain = "Starknet"
		} else if destNormalized == "ztarknet" || destNormalized == "ztrk" {
			actualDestChain = "Ztarknet"
		} else {
			// Validate destination exists in config and get actual name
			allNetworks := config.GetNetworkNames()
			found := false
			for _, networkName := range allNetworks {
				if strings.EqualFold(networkName, destChain) {
					actualDestChain = networkName
					found = true
					break
				}
			}
			if !found {
				return "", fmt.Errorf("destination network not found: %s", destChain)
			}
		}
		
		// Check if origin and destination are the same (compare actual network names)
		if originChain == actualDestChain {
			return "", fmt.Errorf("origin and destination cannot be the same: %s", originChain)
		}
		
		return actualDestChain, nil
	}
	
	// No destination provided, get random
	return GetRandomDestination(originChain)
}

// normalizeChainName normalizes chain names for comparison
// evm -> any EVM chain name, strk/starknet -> Starknet, ztrk/ztarknet -> Ztarknet
func normalizeChainName(chainName string) string {
	lower := strings.ToLower(chainName)
	
	// Handle aliases
	if lower == "strk" || lower == "starknet" {
		return "starknet"
	}
	if lower == "ztrk" || lower == "ztarknet" {
		return "ztarknet"
	}
	if lower == "evm" {
		return "evm"
	}
	
	// Check if it's an EVM chain
	allNetworks := config.GetNetworkNames()
	for _, networkName := range allNetworks {
		if strings.EqualFold(networkName, chainName) {
			netType := GetNetworkType(networkName)
			if netType == NetworkTypeEVM {
				return "evm"
			}
			return strings.ToLower(networkName)
		}
	}
	
	return strings.ToLower(chainName)
}

// GetOriginFromArgs gets origin chain from args
func GetOriginFromArgs(args []string, argIndex int) (string, error) {
	if len(args) <= argIndex {
		return "", fmt.Errorf("origin chain not provided")
	}
	
	originArg := args[argIndex]
	originNormalized := normalizeChainName(originArg)
	
	// Handle special cases
	if originNormalized == "evm" {
		// For "evm", pick a random EVM chain
		allNetworks := config.GetNetworkNames()
		var evmNetworks []string
		for _, networkName := range allNetworks {
			if GetNetworkType(networkName) == NetworkTypeEVM {
				evmNetworks = append(evmNetworks, networkName)
			}
		}
		if len(evmNetworks) == 0 {
			return "", fmt.Errorf("no EVM networks configured")
		}
		idx := secureRandomInt(len(evmNetworks))
		return evmNetworks[idx], nil
	}
	
	// Map aliases to actual network names
	if originNormalized == "starknet" || originNormalized == "strk" {
		return "Starknet", nil
	}
	if originNormalized == "ztarknet" || originNormalized == "ztrk" {
		return "Ztarknet", nil
	}
	
	// Validate origin exists in config
	allNetworks := config.GetNetworkNames()
	for _, networkName := range allNetworks {
		if strings.EqualFold(networkName, originArg) {
			return networkName, nil
		}
	}
	
	return "", fmt.Errorf("origin network not found: %s", originArg)
}

