package types

import (
	"math/big"
	"testing"
)

func TestNewSuccessResult(t *testing.T) {
	data := IntentData{
		FillInstructions: []byte("test"),
		MaxSpent:        []TokenAmount{},
	}
	
	result := NewSuccessResult(data)
	
	if !result.Success {
		t.Error("Expected success result to have Success=true")
	}
	
	if result.Error != "" {
		t.Error("Expected success result to have empty error")
	}
	
	if result.Data.FillInstructions[0] != 't' {
		t.Error("Expected result data to match input")
	}
}

func TestNewErrorResult(t *testing.T) {
	errorMsg := "test error"
	result := NewErrorResult[IntentData](errorMsg)
	
	if result.Success {
		t.Error("Expected error result to have Success=false")
	}
	
	if result.Error != errorMsg {
		t.Error("Expected error result to have correct error message")
	}
}

func TestParsedArgs(t *testing.T) {
	args := ParsedArgs{
		OrderID:       "test-order",
		SenderAddress: "0x123",
		Recipients: []Recipient{
			{
				DestinationChainName: "ethereum",
				RecipientAddress:     "0x456",
			},
		},
		ResolvedOrder: ResolvedOrder{
			User: "0x123",
			MinReceived: []TokenAmount{
				{
					Amount:  big.NewInt(1000000000000000000), // 1 ETH
					ChainID: big.NewInt(1),
					Token:   [32]byte{},
				},
			},
			MaxSpent: []TokenAmount{
				{
					Amount:  big.NewInt(1000000000000000000), // 1 ETH
					ChainID: big.NewInt(1),
					Token:   [32]byte{},
				},
			},
			FillInstructions: []byte("fill"),
		},
	}
	
	if args.OrderID != "test-order" {
		t.Error("Expected OrderID to match")
	}
	
	if len(args.Recipients) != 1 {
		t.Error("Expected 1 recipient")
	}
	
	if args.Recipients[0].DestinationChainName != "ethereum" {
		t.Error("Expected destination chain to match")
	}
}
