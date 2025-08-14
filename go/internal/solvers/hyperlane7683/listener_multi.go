package hyperlane7683

import (
	"context"
	"fmt"
	"math/big"
	"sync"

	"github.com/NethermindEth/oif-starknet/go/internal/config"
	"github.com/NethermindEth/oif-starknet/go/internal/deployer"
	"github.com/NethermindEth/oif-starknet/go/internal/listener"
)

type multiNetworkListener struct {
    state     *deployer.DeploymentState
    listeners map[string]listener.BaseListener
    stopChan  chan struct{}
    mu        sync.RWMutex
}

func NewMultiNetworkListener(state *deployer.DeploymentState) listener.BaseListener {
    return &multiNetworkListener{ state: state, listeners: make(map[string]listener.BaseListener), stopChan: make(chan struct{}) }
}

func (m *multiNetworkListener) Start(ctx context.Context, handler listener.EventHandler) (listener.ShutdownFunc, error) {
    fmt.Printf("Starting multi-network event listener...\n")
    for networkName, networkState := range m.state.Networks {
        if err := m.createNetworkListener(networkName, networkState, handler, ctx); err != nil {
            fmt.Printf("❌ Failed to create listener for %s: %v\n", networkName, err)
            continue
        }
    }
    fmt.Printf("Multi-network listener started with %d networks\n", len(m.listeners))
    return func() { close(m.stopChan) }, nil
}

func (m *multiNetworkListener) createNetworkListener(networkName string, networkState deployer.NetworkState, handler listener.EventHandler, ctx context.Context) error {
    rpcURL := m.getRPCURLForNetwork(networkName)
    cfg := &listener.ListenerConfig{ ContractAddress: networkState.HyperlaneAddress, ChainName: networkName, InitialBlock: big.NewInt(int64(networkState.LastIndexedBlock)), PollInterval: 1000, ConfirmationBlocks: 2, MaxBlockRange: 500 }
    l, err := NewEVMListener(cfg, rpcURL)
    if err != nil { return fmt.Errorf("failed to create EVM listener for %s: %v", networkName, err) }
    if _, err = l.Start(ctx, handler); err != nil { return fmt.Errorf("failed to start listener for %s: %v", networkName, err) }
    m.mu.Lock(); m.listeners[networkName] = l; m.mu.Unlock()
    fmt.Printf("✅ Started listener for %s on %s\n", networkName, rpcURL)
    return nil
}

func (m *multiNetworkListener) getRPCURLForNetwork(networkName string) string {
    rpcURL, err := config.GetRPCURL(networkName)
    if err != nil { fmt.Printf("⚠️  Failed to get RPC URL for network %s, using default: %v\n", networkName, err); return config.GetDefaultRPCURL() }
    return rpcURL
}

func (m *multiNetworkListener) Stop() error {
    fmt.Printf("Stopping multi-network event listener...\n")
    close(m.stopChan)
    m.mu.RLock(); defer m.mu.RUnlock()
    for networkName, l := range m.listeners {
        if err := l.Stop(); err != nil { fmt.Printf("❌ Failed to stop listener for %s: %v\n", networkName, err) }
    }
    fmt.Printf("Multi-network event listener stopped\n")
    return nil
}

func (m *multiNetworkListener) GetLastProcessedBlock() uint64 {
    var highest uint64
    m.mu.RLock(); defer m.mu.RUnlock()
    for _, l := range m.listeners { if block := l.GetLastProcessedBlock(); block > highest { highest = block } }
    return highest
}

