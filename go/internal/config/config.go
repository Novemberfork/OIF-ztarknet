package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/viper"
)

// ChainMetadata represents metadata for a blockchain
type ChainMetadata struct {
	ChainID   uint64   `json:"chainId"`
	RPCUrls   []RPCUrl `json:"rpcUrls"`
	BlockTime int      `json:"blockTime"`
}

// RPCUrl represents an RPC endpoint configuration
type RPCUrl struct {
	HTTP string `json:"http"`
	Pagination *Pagination `json:"pagination,omitempty"`
}

// Pagination configures block range limits
type Pagination struct {
	MaxBlockRange uint64 `json:"maxBlockRange"`
}

// SolverConfig represents configuration for a single solver
type SolverConfig struct {
	Enabled bool `json:"enabled"`
}

// Config holds all configuration
type Config struct {
	Chains     map[string]ChainMetadata `json:"chains"`
	Solvers    map[string]SolverConfig  `json:"solvers"`
	PrivateKey string                   `json:"privateKey"`
	Mnemonic   string                   `json:"mnemonic"`
	LogLevel   string                   `json:"logLevel"`
	LogFormat  string                   `json:"logFormat"`
}

// Default chain configurations
var defaultChains = map[string]ChainMetadata{
	"ethereum": {
		ChainID:   1,
		BlockTime: 12,
		RPCUrls: []RPCUrl{
			{
				HTTP: "https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY",
				Pagination: &Pagination{
					MaxBlockRange: 3000,
				},
			},
		},
	},
	"optimism": {
		ChainID:   10,
		BlockTime: 2,
		RPCUrls: []RPCUrl{
			{
				HTTP: "https://mainnet.optimism.io",
				Pagination: &Pagination{
					MaxBlockRange: 3000,
				},
			},
		},
	},
	"arbitrum": {
		ChainID:   42161,
		BlockTime: 1,
		RPCUrls: []RPCUrl{
			{
				HTTP: "https://arb1.arbitrum.io/rpc",
				Pagination: &Pagination{
					MaxBlockRange: 3000,
				},
			},
		},
	},
	"base": {
		ChainID:   8453,
		BlockTime: 2,
		RPCUrls: []RPCUrl{
			{
				HTTP: "https://mainnet.base.org",
				Pagination: &Pagination{
					MaxBlockRange: 3000,
				},
			},
		},
	},
	"sepolia": {
		ChainID:   11155111,
		BlockTime: 12,
		RPCUrls: []RPCUrl{
			{
				HTTP: "https://rpc.sepolia.org",
				Pagination: &Pagination{
					MaxBlockRange: 3000,
				},
			},
		},
	},
	"optimismsepolia": {
		ChainID:   11155420,
		BlockTime: 2,
		RPCUrls: []RPCUrl{
			{
				HTTP: "https://sepolia.optimism.io",
				Pagination: &Pagination{
					MaxBlockRange: 3000,
				},
			},
		},
	},
	"arbitrumsepolia": {
		ChainID:   421614,
		BlockTime: 1,
		RPCUrls: []RPCUrl{
			{
				HTTP: "https://sepolia-rollup.arbitrum.io/rpc",
				Pagination: &Pagination{
					MaxBlockRange: 3000,
				},
			},
		},
	},
	"basesepolia": {
		ChainID:   84532,
		BlockTime: 2,
		RPCUrls: []RPCUrl{
			{
				HTTP: "https://sepolia.base.org",
				Pagination: &Pagination{
					MaxBlockRange: 3000,
				},
			},
		},
	},
}

// Default solver configurations
var defaultSolvers = map[string]SolverConfig{
	"hyperlane7683": {
		Enabled: true,
	},
}

// LoadConfig loads configuration from environment variables and config files
func LoadConfig() (*Config, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	
	// Set defaults
	viper.SetDefault("chains", defaultChains)
	viper.SetDefault("solvers", defaultSolvers)
	viper.SetDefault("logLevel", "info")
	viper.SetDefault("logFormat", "text")
	
	// Environment variables
	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	
	// Load config file if it exists
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}
	}
	
	// Override with environment variables
	if privateKey := os.Getenv("PRIVATE_KEY"); privateKey != "" {
		viper.Set("privateKey", privateKey)
	}
	
	if mnemonic := os.Getenv("MNEMONIC"); mnemonic != "" {
		viper.Set("mnemonic", mnemonic)
	}
	
	if logLevel := os.Getenv("LOG_LEVEL"); logLevel != "" {
		viper.Set("logLevel", logLevel)
	}
	
	if logFormat := os.Getenv("LOG_FORMAT"); logFormat != "" {
		viper.Set("logFormat", logFormat)
	}
	
	// Override RPC URLs from environment
	for chainName := range defaultChains {
		envKey := fmt.Sprintf("RPC_URL_%s", strings.ToUpper(chainName))
		if rpcURL := os.Getenv(envKey); rpcURL != "" {
			viper.Set(fmt.Sprintf("chains.%s.rpcUrls.0.http", chainName), rpcURL)
		}
	}
	
	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}
	
	return &config, nil
}

// GetChainID returns the chain ID for a given chain name
func (c *Config) GetChainID(chainName string) (uint64, error) {
	chain, exists := c.Chains[chainName]
	if !exists {
		return 0, fmt.Errorf("chain %s not found in configuration", chainName)
	}
	return chain.ChainID, nil
}

// GetChainName returns the chain name for a given chain ID
func (c *Config) GetChainName(chainID uint64) (string, error) {
	for name, chain := range c.Chains {
		if chain.ChainID == chainID {
			return name, nil
		}
	}
	return "", fmt.Errorf("chain ID %d not found in configuration", chainID)
}

// GetRPCURL returns the primary RPC URL for a given chain
func (c *Config) GetRPCURL(chainName string) (string, error) {
	chain, exists := c.Chains[chainName]
	if !exists {
		return "", fmt.Errorf("chain %s not found in configuration", chainName)
	}
	
	if len(chain.RPCUrls) == 0 {
		return "", fmt.Errorf("no RPC URLs configured for chain %s", chainName)
	}
	
	return chain.RPCUrls[0].HTTP, nil
}

// IsSolverEnabled checks if a solver is enabled
func (c *Config) IsSolverEnabled(solverName string) bool {
	solver, exists := c.Solvers[solverName]
	if !exists {
		return false
	}
	return solver.Enabled
}

// GetMaxBlockRange returns the maximum block range for pagination
func (c *Config) GetMaxBlockRange(chainName string) uint64 {
	chain, exists := c.Chains[chainName]
	if !exists {
		return 3000 // default
	}
	
	if len(chain.RPCUrls) == 0 {
		return 3000 // default
	}
	
	if chain.RPCUrls[0].Pagination != nil {
		return chain.RPCUrls[0].Pagination.MaxBlockRange
	}
	
	return 3000 // default
}
