package listener

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/NethermindEth/oif-starknet/go/internal/types"
)

// EVMListener implements BaseListener for EVM chains
type EVMListener struct {
	config *ListenerConfig
	// TODO: Add go-ethereum client and contract bindings
	lastProcessedBlock uint64
	stopChan           chan struct{}
}

// NewEVMListener creates a new EVM listener
func NewEVMListener(config *ListenerConfig) *EVMListener {
	return &EVMListener{
		config:   config,
		stopChan: make(chan struct{}),
	}
}

// Start begins listening for events
func (l *EVMListener) Start(ctx context.Context, handler EventHandler) (ShutdownFunc, error) {
	// For now, this is a mock implementation that simulates events
	// In the real implementation, this would:
	// 1. Connect to the EVM node
	// 2. Subscribe to Hyperlane7683 Open events
	// 3. Parse and forward events to the handler
	
	go l.mockEventLoop(ctx, handler)
	
	// Return shutdown function
	return func() {
		close(l.stopChan)
	}, nil
}

// Stop gracefully stops the listener
func (l *EVMListener) Stop() error {
	close(l.stopChan)
	return nil
}

// GetLastProcessedBlock returns the last processed block number
func (l *EVMListener) GetLastProcessedBlock() uint64 {
	return l.lastProcessedBlock
}

// mockEventLoop simulates event processing for testing
func (l *EVMListener) mockEventLoop(ctx context.Context, handler EventHandler) {
	ticker := time.NewTicker(time.Duration(l.config.PollInterval) * time.Millisecond)
	defer ticker.Stop()
	
	blockNumber := uint64(1000000) // Start from a reasonable block number
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-l.stopChan:
			return
		case <-ticker.C:
			// Simulate processing a block
			blockNumber++
			l.lastProcessedBlock = blockNumber
			
			// Every 10 blocks, simulate an Open event
			if blockNumber%10 == 0 {
				// Create a mock event
				mockArgs := types.ParsedArgs{
					OrderID:       fmt.Sprintf("order-%d", blockNumber),
					SenderAddress: "0x1234567890123456789012345678901234567890",
					Recipients: []types.Recipient{
						{
							DestinationChainName: "ethereum",
							RecipientAddress:     "0x0987654321098765432109876543210987654321",
						},
					},
					ResolvedOrder: types.ResolvedOrder{
						User: "0x1234567890123456789012345678901234567890",
						MinReceived: []types.TokenAmount{
							{
								Amount:  big.NewInt(1000000000000000000), // 1 ETH
								ChainID: big.NewInt(1),
								Token:   [32]byte{},
							},
						},
						MaxSpent: []types.TokenAmount{
							{
								Amount:  big.NewInt(1000000000000000000), // 1 ETH
								ChainID: big.NewInt(1),
								Token:   [32]byte{},
							},
						},
						FillInstructions: []byte("mock_fill_instructions"),
					},
				}
				
				// Call the handler
				if err := handler(mockArgs, l.config.ChainName, blockNumber); err != nil {
					// In a real implementation, we'd log this error
					fmt.Printf("Error handling mock event: %v\n", err)
				}
			}
		}
	}
}
