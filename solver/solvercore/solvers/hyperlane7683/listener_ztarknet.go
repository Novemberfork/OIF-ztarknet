package hyperlane7683

// Module: Ztarknet Open event listener for Hyperlane7683
// - Polls/backfills block ranges on Ztarknet
// - Parses Cairo Open events and reconstructs EVM-compatible ResolvedCrossChainOrder
// - Invokes the filler with parsed args
// - Persists last processed block via deployment state

import (
	"bytes"
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/NethermindEth/juno/core/felt"
	"github.com/NethermindEth/starknet.go/rpc"
	"github.com/ethereum/go-ethereum/common"

	"github.com/NethermindEth/oif-starknet/solver/solvercore/base"
	"github.com/NethermindEth/oif-starknet/solver/solvercore/logutil"
	"github.com/NethermindEth/oif-starknet/solver/solvercore/types"
)

// ztarknetListener implements listener.Listener for Ztarknet chains
type ztarknetListener struct {
	config             *base.ListenerConfig
	provider           *rpc.Provider
	contractAddress    *felt.Felt
	lastProcessedBlock uint64
	stopChan           chan struct{}
	mu                 sync.RWMutex
	baseListener       *BaseListener
}

// NewZtarknetListener creates a new Ztarknet listener
func NewZtarknetListener(listenerConfig *base.ListenerConfig, rpcURL string) (base.Listener, error) {
	provider, err := rpc.NewProvider(rpcURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect Ztarknet RPC: %w", err)
	}

	addrFelt, err := types.ToStarknetAddress(listenerConfig.ContractAddress)
	if err != nil {
		return nil, fmt.Errorf("invalid Ztarknet contract address: %w", err)
	}

	ctx := context.Background()
	commonConfig, err := ResolveCommonListenerConfig(ctx, listenerConfig, provider)
	if err != nil {
		return nil, err
	}

	baseListener := NewBaseListener(*listenerConfig, provider, "Ztarknet")
	baseListener.SetLastProcessedBlock(commonConfig.LastProcessedBlock)
	
	return &ztarknetListener{
		config:             listenerConfig,
		provider:           provider,
		contractAddress:    addrFelt,
		lastProcessedBlock: commonConfig.LastProcessedBlock,
		stopChan:           make(chan struct{}),
		mu:                 sync.RWMutex{},
		baseListener:       baseListener,
	}, nil
}

// Start begins listening for events
func (l *ztarknetListener) Start(ctx context.Context, handler base.EventHandler) (base.ShutdownFunc, error) {
	go l.startEventLoop(ctx, handler)
	return func() { close(l.stopChan) }, nil
}

// Stop gracefully stops the listener
func (l *ztarknetListener) Stop() error {
	close(l.stopChan)
	return nil
}

// GetLastProcessedBlock returns the last processed block number
func (l *ztarknetListener) GetLastProcessedBlock() uint64 {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.lastProcessedBlock
}

// MarkBlockFullyProcessed marks a block as fully processed
func (l *ztarknetListener) MarkBlockFullyProcessed(blockNumber uint64) error {
	if blockNumber != l.lastProcessedBlock+1 {
		return fmt.Errorf("cannot mark block %d as processed, expected %d", blockNumber, l.lastProcessedBlock+1)
	}
	l.lastProcessedBlock = blockNumber
	fmt.Printf("%s✅ block %d processed\n", logutil.Prefix(l.config.ChainName), blockNumber)
	return nil
}

func (l *ztarknetListener) startEventLoop(ctx context.Context, handler base.EventHandler) {
	p := logutil.Prefix(l.config.ChainName)
	if err := l.catchUpHistoricalBlocks(ctx, handler); err != nil {
		fmt.Printf("%s❌ backfill failed: %v\n", p, err)
	}
	fmt.Printf("%s🔄 backfill complete\n", p)
	l.startPolling(ctx, handler)
}

func (l *ztarknetListener) catchUpHistoricalBlocks(ctx context.Context, handler base.EventHandler) error {
	return l.baseListener.CatchUpHistoricalBlocks(ctx, handler, l.processBlockRange)
}

func (l *ztarknetListener) startPolling(ctx context.Context, handler base.EventHandler) {
	fmt.Printf("%s📭 Starting event polling...\n", logutil.Prefix(l.config.ChainName))
	for {
		select {
		case <-ctx.Done():
			fmt.Printf("🔄 Context canceled, stopping event polling\n")
			return
		case <-l.stopChan:
			fmt.Printf("🔄 Stop signal received, stopping event polling\n")
			return
		default:
			if err := l.processCurrentBlockRange(ctx, handler); err != nil {
				fmt.Printf("%s❌ Failed to process current block range: %v\n", logutil.Prefix(l.config.ChainName), err)
			}
			time.Sleep(time.Duration(l.config.PollInterval) * time.Millisecond)
		}
	}
}

func (l *ztarknetListener) processCurrentBlockRange(ctx context.Context, handler base.EventHandler) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	return ProcessCurrentBlockRangeCommon(ctx, handler, l.provider, l.config, &l.lastProcessedBlock, "Ztarknet", l.processBlockRange)
}

// processBlockRange processes events in [fromBlock, toBlock] and returns the highest contiguous block fully processed
func (l *ztarknetListener) processBlockRange(ctx context.Context, fromBlock, toBlock uint64, handler base.EventHandler) (uint64, error) {
	if fromBlock > toBlock {
		fmt.Printf("⚠️  Invalid block range (%s) in processBlockRange: fromBlock (%d) > toBlock (%d), skipping\n", l.config.ChainName, fromBlock, toBlock)
		return l.lastProcessedBlock, nil
	}

	// Fetch events for the block range
	filter := rpc.EventFilter{
		FromBlock: rpc.BlockID{
			Number: &fromBlock,
			Hash:   nil,
			Tag:    "",
		},
		ToBlock: rpc.BlockID{
			Number: &toBlock,
			Hash:   nil,
			Tag:    "",
		},
		Address: l.contractAddress,
		Keys:    [][]*felt.Felt{{openEventSelector}},
	}

	query := rpc.EventsInput{
		EventFilter:       filter,
		ResultPageRequest: rpc.ResultPageRequest{ChunkSize: 128, ContinuationToken: ""},
	}

	logs, err := l.provider.Events(ctx, query)
	if err != nil {
		return l.lastProcessedBlock, fmt.Errorf("failed to filter events: %w", err)
	}

	logutil.LogWithNetworkTagf(l.config.ChainName, "📩 events found: %d\n", len(logs.Events))
	if len(logs.Events) > 0 {
		fmt.Printf("📩 Found %d Open events on %s\n", len(logs.Events), l.config.ChainName)
	}

	// Group logs by block
	byBlock := make(map[uint64][]rpc.EmittedEvent)
	for _, event := range logs.Events {
		byBlock[event.BlockNumber] = append(byBlock[event.BlockNumber], event)
	}

	// Process blocks in order
	newLast := l.lastProcessedBlock
	for b := fromBlock; b <= toBlock; b++ {
		events := byBlock[b]

		// Process each event in this block
		for _, event := range events {
			// Ensure each event is the correct type
			isOpen := false
			if len(event.Event.Keys) >= 1 {
				actual := event.Event.Keys[0].Bytes()
				expected := openEventSelector.Bytes()
				if bytes.Equal(actual[:], expected[:]) {
					isOpen = true
				}
			}
			if !isOpen {
				continue
			}

			// Parse Open event
			ro := decodeResolvedOrderFromFelts(event.Event.Data)
			parsedArgs := types.ParsedArgs{
				OrderID:       common.BytesToHash(ro.OrderID[:]).Hex(),
				SenderAddress: ro.User,
				Recipients:    []types.Recipient{{DestinationChainName: l.config.ChainName, RecipientAddress: "*"}},
				ResolvedOrder: ro,
			}

			// Handle the event
			_, herr := handler(parsedArgs, l.config.ChainName, b)
			if herr != nil {
				fmt.Printf("❌ Failed to handle event: %v\n", herr)
				continue
			}
		}

		// Mark block as processed
		newLast = b
		// Only log individual blocks if there are events
		if len(events) > 0 {
			logutil.LogWithNetworkTagf(l.config.ChainName, "   ✅ Block %d processed: %d events\n", b, len(events))
		}
	}

	return newLast, nil
}

