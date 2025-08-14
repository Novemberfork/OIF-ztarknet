package listener

import (
	"context"
	"fmt"
	"math/big"
	"sync"
	"time"

	"github.com/NethermindEth/oif-starknet/go/internal/deployer"
	"github.com/NethermindEth/oif-starknet/go/internal/types"
	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	ethtypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

// Open event topic: Open(bytes32,ResolvedCrossChainOrder)
var openEventTopic = common.HexToHash("0x3448bbc2203c608599ad448eeb1007cea04b788ac631f9f558e8dd01a3c27b3d")

// EVMListener implements BaseListener for EVM chains
type EVMListener struct {
	config             *ListenerConfig
	client             *ethclient.Client
	contractAddress    common.Address
	logger             interface{}
	lastProcessedBlock uint64
	stopChan           chan struct{}
	mu                 sync.RWMutex
}

// NewEVMListener creates a new EVM listener
func NewEVMListener(config *ListenerConfig, rpcURL string, logger interface{}) (*EVMListener, error) {
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, fmt.Errorf("failed to dial RPC: %w", err)
	}

	// Initialize lastProcessedBlock safely, handling nil/zero InitialBlock
	var lastProcessedBlock uint64
	if config.InitialBlock == nil || config.InitialBlock.Sign() <= 0 {
		// If no initial block specified, start from current block
		currentBlock, err := client.BlockNumber(context.Background())
		if err != nil {
			return nil, fmt.Errorf("failed to get current block number: %w", err)
		}
		lastProcessedBlock = currentBlock
	} else {
		// Start from specified initial block - 1 to ensure we process from InitialBlock
		lastProcessedBlock = config.InitialBlock.Uint64() - 1
	}

	return &EVMListener{
		config:             config,
		client:             client,
		contractAddress:    common.HexToAddress(config.ContractAddress),
		logger:             logger,
		lastProcessedBlock: lastProcessedBlock,
		stopChan:           make(chan struct{}),
	}, nil
}

// Start begins listening for events
func (l *EVMListener) Start(ctx context.Context, handler EventHandler) (ShutdownFunc, error) {
	// Start real event listening
	go l.realEventLoop(ctx, handler)

	// Return shutdown function
	return func() {
		close(l.stopChan)
	}, nil
}

// Stop gracefully stops the listener
func (l *EVMListener) Stop() error {
	fmt.Printf("Stopping EVM listener...\n")

	// Close stop channel
	close(l.stopChan)

	// ethclient.Client doesn't have a Close method
	return nil
}

// GetLastProcessedBlock returns the last processed block number
func (l *EVMListener) GetLastProcessedBlock() uint64 {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.lastProcessedBlock
}

// MarkBlockFullyProcessed marks a block as fully processed and updates LastIndexedBlock
// This should be called after all events in a block have been processed/filled
func (l *EVMListener) MarkBlockFullyProcessed(blockNumber uint64) error {
	// Only update if this is the next block in sequence
	if blockNumber != l.lastProcessedBlock+1 {
		return fmt.Errorf("cannot mark block %d as processed, expected %d", blockNumber, l.lastProcessedBlock+1)
	}
	
	// Update the last processed block
	l.lastProcessedBlock = blockNumber
	
	// TODO: This method should be called by the solver manager after all events in a block are processed
	// The solver manager will handle updating LastIndexedBlock via deployer.UpdateLastIndexedBlock
	// This ensures proper coordination between event processing and block indexing
	
	fmt.Printf("✅ Block %d marked as fully processed for %s\n", blockNumber, l.config.ChainName)
	return nil
}

// realEventLoop implements simple polling for local forks (which don't support eth_subscribe)
func (l *EVMListener) realEventLoop(ctx context.Context, handler EventHandler) {
	fmt.Printf("⚙️  Starting (%s) event listener...\n", l.config.ChainName)

	// Step 1: Catch up on historical blocks (MUST complete before polling starts)
	if err := l.catchUpHistoricalBlocks(ctx, handler); err != nil {
		fmt.Printf("❌ Failed to catch up on (%s) historical blocks: %v\n", l.config.ChainName, err)
		// Continue anyway, we can still listen to new events
	}

	// Small delay to ensure blockchain state is stable after backfill
	fmt.Printf("🔄 Backfill complete (%s)\n", l.config.ChainName)
	time.Sleep(1 * time.Second)

	// Step 2: Start polling for new events (only after backfill is complete)
	l.startPolling(ctx, handler)
}

// processCurrentBlockRange processes the current block range for events
func (l *EVMListener) processCurrentBlockRange(ctx context.Context, handler EventHandler) error {
	// Get current block
	currentBlock, err := l.client.BlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("failed to get current block number: %v", err)
	}

	// Only process new blocks since last processed
	if currentBlock <= l.lastProcessedBlock {
		return nil // Silent when no new blocks
	}

	// Process new blocks from last processed + 1 to current
	fromBlock := l.lastProcessedBlock + 1
	toBlock := currentBlock

	// Defensive check: ensure we have a valid range
	if fromBlock > toBlock {
		fmt.Printf("⚠️  Invalid block range for %s: fromBlock (%d) > toBlock (%d), skipping\n", l.config.ChainName, fromBlock, toBlock)
		return nil
	}

	// Process the block range
	if err := l.processBlockRange(ctx, fromBlock, toBlock, handler); err != nil {
		return fmt.Errorf("failed to process blocks %d-%d: %v", fromBlock, toBlock, err)
	}

	// Update the last processed block (but don't persist to deployment state yet)
	// TODO: We only persist after all events in the block have been fully processed/filled
	// This means:
	// 1. Process all events in the block
	// 2. For each event: check if already filled, if not then fill it
	// 3. Only after ALL events in the block are processed/filled, update LastIndexedBlock
	// 4. This ensures we never skip a block with unprocessed events
	l.lastProcessedBlock = toBlock

	// Persist LastIndexedBlock so that on restart we don't reprocess already-filled events
	if err := deployer.UpdateLastIndexedBlock(l.config.ChainName, toBlock); err != nil {
		fmt.Printf("⚠️  Failed to persist LastIndexedBlock for %s: %v\n", l.config.ChainName, err)
	} else {
		fmt.Printf("💾 Persisted LastIndexedBlock=%d for %s\n", toBlock, l.config.ChainName)
	}

	return nil
}

// processBlockRange processes a range of blocks for Open events only
func (l *EVMListener) processBlockRange(ctx context.Context, fromBlock, toBlock uint64, handler EventHandler) error {
	// Defensive check: ensure we have a valid range
	if fromBlock > toBlock {
		fmt.Printf("⚠️  Invalid block range (%s) in processBlockRange: fromBlock (%d) > toBlock (%d), skipping\n", l.config.ChainName, fromBlock, toBlock)
		return nil
	}

	// Query for Open events only
	query := ethereum.FilterQuery{
		FromBlock: big.NewInt(int64(fromBlock)),
		ToBlock:   big.NewInt(int64(toBlock)),
		Addresses: []common.Address{l.contractAddress},
		Topics: [][]common.Hash{
			{openEventTopic}, // Only Open events
		},
	}

	logs, err := l.client.FilterLogs(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to filter logs: %v", err)
	}

	// Only log if we found events
	if len(logs) > 0 {
		fmt.Printf("📩 Found %d Open events on %s\n", len(logs), l.config.ChainName)

		// // Debug: Log each event's details
		// for i, log := range logs {
		// 	l.logger.Infof("📋 Event %d: Block=%d, TxHash=%s, Topics=%v",
		// 		i+1, log.BlockNumber, log.TxHash.Hex(), log.Topics)
		// }
	}

	// Process each Open event directly
	for _, log := range logs {
		if err := l.processOpenEvent(log, handler); err != nil {
			fmt.Printf("❌ Failed to process Open event: %v\n", err)
			continue
		}
	}

	return nil
}

// processOpenEvent processes a single Open event
func (l *EVMListener) processOpenEvent(log ethtypes.Log, handler EventHandler) error {
	// Parse the Open event
	// Event structure: Open(bytes32 indexed orderId, ResolvedCrossChainOrder resolvedOrder)

	// Extract orderId from indexed topic
	if len(log.Topics) < 2 {
		return fmt.Errorf("invalid Open event: missing orderId topic")
	}
	orderID := log.Topics[1] // orderId is the first indexed parameter

	// Parse the actual ResolvedCrossChainOrder from the event data
	resolvedOrder, err := l.parseResolvedCrossChainOrder(log.Data)
	if err != nil {
		return fmt.Errorf("failed to parse ResolvedCrossChainOrder: %w", err)
	}

	// Create ParsedArgs with the real parsed data
	parsedArgs := types.ParsedArgs{
		OrderID:       orderID.Hex(),
		SenderAddress: resolvedOrder.User.Hex(), // Now directly common.Address
		Recipients: []types.Recipient{
			{
				DestinationChainName: l.config.ChainName,                           // We'll need to map this properly
				RecipientAddress:     "0x0000000000000000000000000000000000000000", // Placeholder for now
			},
		},
		ResolvedOrder: *resolvedOrder,
	}

	fmt.Printf("📜 Open order: OrderID=%s, Chain=%s\n",
		orderID.Hex(), l.config.ChainName)
	fmt.Printf("   📊 Order details: User=%s, OriginChainID=%s, FillDeadline=%d\n",
		resolvedOrder.User.Hex(), // Now directly common.Address
		resolvedOrder.OriginChainID.String(),
		resolvedOrder.FillDeadline)
	fmt.Printf("   📦 Arrays: MaxSpent=%d, MinReceived=%d, FillInstructions=%d\n",
		len(resolvedOrder.MaxSpent), len(resolvedOrder.MinReceived), len(resolvedOrder.FillInstructions))

	// Add comprehensive logging for the complete decoded order
	fmt.Printf("   🔍 Complete Decoded Order:\n")
	fmt.Printf("      📋 User: %s\n", resolvedOrder.User.Hex())
	fmt.Printf("      📋 OriginChainID: %s\n", resolvedOrder.OriginChainID.String())
	fmt.Printf("      📋 OpenDeadline: %d\n", resolvedOrder.OpenDeadline)
	fmt.Printf("      📋 FillDeadline: %d\n", resolvedOrder.FillDeadline)
	fmt.Printf("      📋 OrderID: %x\n", resolvedOrder.OrderID)
	
	// Log MaxSpent array details
	fmt.Printf("      💰 MaxSpent (%d items):\n", len(resolvedOrder.MaxSpent))
	for i, output := range resolvedOrder.MaxSpent {
		fmt.Printf("         [%d] Token: %s\n", i, output.Token.Hex())
		fmt.Printf("         [%d] Amount: %s\n", i, output.Amount.String())
		fmt.Printf("         [%d] Recipient: %s\n", i, output.Recipient.Hex())
		fmt.Printf("         [%d] ChainID: %s\n", i, output.ChainID.String())
	}
	
	// Log MinReceived array details
	fmt.Printf("      💰 MinReceived (%d items):\n", len(resolvedOrder.MinReceived))
	for i, output := range resolvedOrder.MinReceived {
		fmt.Printf("         [%d] Token: %s\n", i, output.Token.Hex())
		fmt.Printf("         [%d] Amount: %s\n", i, output.Amount.String())
		fmt.Printf("         [%d] Recipient: %s\n", i, output.Recipient.Hex())
		fmt.Printf("         [%d] ChainID: %s\n", i, output.ChainID.String())
	}
	
	// Log FillInstructions array details
	fmt.Printf("      📋 FillInstructions (%d items):\n", len(resolvedOrder.FillInstructions))
	for i, instruction := range resolvedOrder.FillInstructions {
		fmt.Printf("         [%d] DestinationChainID: %s\n", i, instruction.DestinationChainID.String())
		fmt.Printf("         [%d] DestinationSettler: %s\n", i, instruction.DestinationSettler.Hex())
		fmt.Printf("         [%d] OriginData: %d bytes\n", i, len(instruction.OriginData))
		if len(instruction.OriginData) > 0 {
			fmt.Printf("         [%d] OriginData (first 64 bytes): %x...\n", i, instruction.OriginData[:min(64, len(instruction.OriginData))])
		}
	}

	// Call the handler
	return handler(parsedArgs, l.config.ChainName, log.BlockNumber)
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// parseResolvedCrossChainOrder parses the ResolvedCrossChainOrder struct from event data
// Using proper ABI decoding for complex nested structs with abi.NewType
func (l *EVMListener) parseResolvedCrossChainOrder(data []byte) (*types.ResolvedCrossChainOrder, error) {
    // Define component types for tuple decoding to leverage go-ethereum's ABI fully
    outputComponents := []abi.ArgumentMarshaling{
        {Name: "token", Type: "address"},     // Changed from bytes32 to address
        {Name: "amount", Type: "uint256"},
        {Name: "recipient", Type: "address"}, // Changed from bytes32 to address
        {Name: "chainId", Type: "uint256"},
    }

    fillInstructionComponents := []abi.ArgumentMarshaling{
        {Name: "destinationChainId", Type: "uint256"},
        {Name: "destinationSettler", Type: "address"}, // Changed from bytes32 to address
        {Name: "originData", Type: "bytes"},
    }

    resolvedOrderType, err := abi.NewType("tuple", "", []abi.ArgumentMarshaling{
        {Name: "user", Type: "address"},
        {Name: "originChainId", Type: "uint256"},
        {Name: "openDeadline", Type: "uint32"},
        {Name: "fillDeadline", Type: "uint32"},
        {Name: "orderId", Type: "bytes32"},
        {Name: "maxSpent", Type: "tuple[]", Components: outputComponents},
        {Name: "minReceived", Type: "tuple[]", Components: outputComponents},
        {Name: "fillInstructions", Type: "tuple[]", Components: fillInstructionComponents},
    })
    if err != nil {
        return nil, fmt.Errorf("failed to define ResolvedCrossChainOrder tuple type: %w", err)
    }

    // Temporary Go structs to decode directly from ABI
    type goOutput struct {
        Token     common.Address // Changed from [32]byte to common.Address
        Amount    *big.Int
        Recipient common.Address // Changed from [32]byte to common.Address
        ChainId   *big.Int
    }
    type goFillInstruction struct {
        DestinationChainId *big.Int
        DestinationSettler common.Address // Changed from [32]byte to common.Address
        OriginData         []byte
    }
    type goResolved struct {
        User             common.Address
        OriginChainId    *big.Int
        OpenDeadline     uint32
        FillDeadline     uint32
        OrderId          [32]byte
        MaxSpent         []goOutput
        MinReceived      []goOutput
        FillInstructions []goFillInstruction
    }

    args := abi.Arguments{{Type: resolvedOrderType}}

    out, err := args.Unpack(data)
    if err != nil {
        return nil, fmt.Errorf("failed to ABI-decode ResolvedCrossChainOrder: %w", err)
    }
    if len(out) != 1 {
        return nil, fmt.Errorf("unexpected decoded outputs: %d", len(out))
    }

    // Since the ABI decoding is working, let's try to use type assertion directly
    // The decoded data should be a struct of type goResolved
    decoded, ok := out[0].(goResolved)
    if !ok {
        // If direct type assertion fails, use abi.ConvertType as a cleaner alternative
        fmt.Printf("   ⚠️  Direct type assertion failed, trying abi.ConvertType...\n")
        
        // Use abi.ConvertType to convert the decoded data to our struct type
        converted := abi.ConvertType(out[0], new(goResolved))
        if converted == nil {
            return nil, fmt.Errorf("failed to convert decoded data using abi.ConvertType")
        }
        
        decoded = *converted.(*goResolved)
        fmt.Printf("   ✅ Successfully converted using abi.ConvertType\n")
    }

    // Debug: Log the extracted arrays
    fmt.Printf("   🔍 Extracted MaxSpent: %d elements\n", len(decoded.MaxSpent))
    fmt.Printf("   🔍 Extracted MinReceived: %d elements\n", len(decoded.MinReceived))
    fmt.Printf("   🔍 Extracted FillInstructions: %d elements\n", len(decoded.FillInstructions))

    // Map decoded struct into our public types
    ro := &types.ResolvedCrossChainOrder{
        User:             decoded.User,           // Now directly common.Address
        OriginChainID:    decoded.OriginChainId,
        OpenDeadline:     decoded.OpenDeadline,
        FillDeadline:     decoded.FillDeadline,
        OrderID:          decoded.OrderId,
        MaxSpent:         make([]types.Output, 0, len(decoded.MaxSpent)),
        MinReceived:      make([]types.Output, 0, len(decoded.MinReceived)),
        FillInstructions: make([]types.FillInstruction, 0, len(decoded.MinReceived)),
    }

    // Convert MaxSpent outputs
    for _, o := range decoded.MaxSpent {
        ro.MaxSpent = append(ro.MaxSpent, types.Output{
            Token:     o.Token,     // Now directly common.Address
            Amount:    o.Amount,
            Recipient: o.Recipient, // Now directly common.Address
            ChainID:   o.ChainId,
        })
    }

    // Convert MinReceived outputs
    for _, o := range decoded.MinReceived {
        ro.MinReceived = append(ro.MinReceived, types.Output{
            Token:     o.Token,     // Now directly common.Address
            Amount:    o.Amount,
            Recipient: o.Recipient, // Now directly common.Address
            ChainID:   o.ChainId,
        })
    }

    // Convert FillInstructions
    for _, fi := range decoded.FillInstructions {
        ro.FillInstructions = append(ro.FillInstructions, types.FillInstruction{
            DestinationChainID: fi.DestinationChainId,
            DestinationSettler: fi.DestinationSettler, // Now directly common.Address
            OriginData:         fi.OriginData,
        })
    }

    return ro, nil
}

// catchUpHistoricalBlocks processes all historical blocks to catch up on missed events
func (l *EVMListener) catchUpHistoricalBlocks(ctx context.Context, handler EventHandler) error {
	fmt.Printf("🔄 Catching up on (%s) historical blocks...\n", l.config.ChainName)

	// Get current block
	currentBlock, err := l.client.BlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("failed to get current block number: %v", err)
	}

	// Process from initial block to current block, handling nil/zero InitialBlock
	var fromBlock uint64
	if l.config.InitialBlock == nil || l.config.InitialBlock.Sign() <= 0 {
		// If no initial block specified, start from current block (no historical processing needed)
		fromBlock = currentBlock
	} else {
		fromBlock = l.config.InitialBlock.Uint64()
	}
	toBlock := currentBlock

	if fromBlock >= toBlock {
		fmt.Printf("✅ Already up to date, no historical blocks to process\n")
		return nil
	}

	// Ensure we start from the correct block (should be InitialBlock)
	if l.lastProcessedBlock != fromBlock-1 {
		fmt.Printf("⚠️  lastProcessedBlock mismatch: expected %d, got %d, correcting...\n", fromBlock-1, l.lastProcessedBlock)
		l.lastProcessedBlock = fromBlock - 1
	}

	// Process in chunks to avoid overwhelming the node
	chunkSize := l.config.MaxBlockRange

	for start := fromBlock; start < toBlock; start += chunkSize {
		end := start + chunkSize
		if end > toBlock {
			end = toBlock
		}

		if err := l.processBlockRange(ctx, start, end, handler); err != nil {
			return fmt.Errorf("failed to process historical blocks %d-%d: %v", start, end, err)
		}
	}

	// Update last processed block only after ALL historical blocks are processed
	l.lastProcessedBlock = toBlock

	fmt.Printf("✅ Historical block processing completed for %s\n", l.config.ChainName)
	return nil
}

// startPolling continuously polls for new Open events
func (l *EVMListener) startPolling(ctx context.Context, handler EventHandler) {
	fmt.Printf("📭 Starting event polling...\n")

	for {
		select {
		case <-ctx.Done():
			fmt.Printf("🔄 Context cancelled, stopping event polling\n")
			return
		case <-l.stopChan:
			fmt.Printf("🔄 Stop signal received, stopping event polling\n")
			return
		default:
			// Process current block range
			if err := l.processCurrentBlockRange(ctx, handler); err != nil {
				fmt.Printf("❌ Failed to process current block range: %v\n", err)
			}

			// Wait for next poll interval using configured value
			time.Sleep(time.Duration(l.config.PollInterval) * time.Millisecond)
		}
	}
}
