package types

import (
	"math/big"
)

// ParsedArgs represents the parsed arguments from an Open event
type ParsedArgs struct {
	OrderID        string   `json:"orderId"`
	SenderAddress  string   `json:"senderAddress"`
	Recipients     []Recipient `json:"recipients"`
	ResolvedOrder  ResolvedOrder `json:"resolvedOrder"`
}

// Recipient represents a destination recipient
type Recipient struct {
	DestinationChainName string `json:"destinationChainName"`
	RecipientAddress    string `json:"recipientAddress"`
}

// ResolvedOrder contains the order details
type ResolvedOrder struct {
	User       string           `json:"user"`
	MinReceived []TokenAmount   `json:"minReceived"`
	MaxSpent   []TokenAmount   `json:"maxSpent"`
	FillInstructions []byte     `json:"fillInstructions"`
}

// TokenAmount represents a token amount on a specific chain
type TokenAmount struct {
	Amount  *big.Int `json:"amount"`
	ChainID *big.Int `json:"chainId"`
	Token   [32]byte `json:"token"`
}

// IntentData contains the data needed to fill an intent
type IntentData struct {
	FillInstructions []byte       `json:"fillInstructions"`
	MaxSpent        []TokenAmount `json:"maxSpent"`
}

// BaseMetadata contains common metadata for all solvers
type BaseMetadata struct {
	ProtocolName string `json:"protocolName"`
}

// Hyperlane7683Metadata extends base metadata with Hyperlane-specific config
type Hyperlane7683Metadata struct {
	BaseMetadata
	IntentSources []IntentSource `json:"intentSources"`
	CustomRules   CustomRules    `json:"customRules"`
}

// IntentSource represents a contract to monitor for events
type IntentSource struct {
	Address         string   `json:"address"`
	ChainName       string   `json:"chainName"`
	InitialBlock    *big.Int `json:"initialBlock,omitempty"`
	PollInterval    int      `json:"pollInterval,omitempty"`
	ConfirmationBlocks int   `json:"confirmationBlocks,omitempty"`
	ProcessedIDs    []string `json:"processedIds,omitempty"`
}

// CustomRules contains configuration for custom rules
type CustomRules struct {
	Rules []RuleConfig `json:"rules"`
}

// RuleConfig represents a single rule configuration
type RuleConfig struct {
	Name string                 `json:"name"`
	Args map[string]interface{} `json:"args,omitempty"`
}

// AllowBlockListItem represents a single allow/block list item
type AllowBlockListItem struct {
	SenderAddress      string   `json:"senderAddress"`
	DestinationDomain  string   `json:"destinationDomain"`
	RecipientAddress   string   `json:"recipientAddress"`
}

// AllowBlockLists contains allow and block lists
type AllowBlockLists struct {
	AllowList []AllowBlockListItem `json:"allowList"`
	BlockList []AllowBlockListItem `json:"blockList"`
}

// Result represents a generic result with success/error handling
type Result[T any] struct {
	Data    T      `json:"data,omitempty"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// NewSuccessResult creates a successful result
func NewSuccessResult[T any](data T) Result[T] {
	return Result[T]{
		Data:    data,
		Success: true,
	}
}

// NewErrorResult creates an error result
func NewErrorResult[T any](err string) Result[T] {
	return Result[T]{
		Success: false,
		Error:   err,
	}
}
