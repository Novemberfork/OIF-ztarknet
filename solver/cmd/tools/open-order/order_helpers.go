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

