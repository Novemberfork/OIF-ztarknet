package hyperlane7683

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"os"
	"strings"

	"github.com/NethermindEth/oif-starknet/go/internal/config"
	contracts "github.com/NethermindEth/oif-starknet/go/internal/contracts"
	"github.com/NethermindEth/oif-starknet/go/internal/filler"
	"github.com/NethermindEth/oif-starknet/go/internal/types"
	"github.com/NethermindEth/oif-starknet/go/pkg/ethutil"
	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

var UnknownOrderStatus = common.Hash{}
var ErrIntentAlreadyFilled = errors.New("intent already filled")

type Hyperlane7683Filler struct {
	*filler.BaseFillerImpl
	client   *ethclient.Client
	clients  map[uint64]*ethclient.Client
	signers  map[uint64]*bind.TransactOpts
	metadata types.Hyperlane7683Metadata
}

func NewHyperlane7683Filler(client *ethclient.Client) *Hyperlane7683Filler {
	metadata := types.Hyperlane7683Metadata{
		BaseMetadata: types.BaseMetadata{ProtocolName: "Hyperlane7683"},
		IntentSources: []types.IntentSource{},
		CustomRules:   types.CustomRules{},
	}

	allowBlockLists := types.AllowBlockLists{AllowList: []types.AllowBlockListItem{}, BlockList: []types.AllowBlockListItem{}}

	return &Hyperlane7683Filler{
		BaseFillerImpl: filler.NewBaseFiller(allowBlockLists, metadata),
		client:         client,
		clients:        make(map[uint64]*ethclient.Client),
		signers:        make(map[uint64]*bind.TransactOpts),
		metadata:       metadata,
	}
}

func (f *Hyperlane7683Filler) ProcessIntent(ctx context.Context, args types.ParsedArgs, originChainName string, blockNumber uint64) error {
	fmt.Printf("🔵 Processing Intent: %s-%s on chain %s (block %d)\n", f.metadata.ProtocolName, args.OrderID, originChainName, blockNumber)
	intent, err := f.PrepareIntent(ctx, args)
	if err != nil {
		return err
	}
	if !intent.Success {
		return nil
	}
	if err := f.Fill(ctx, args, intent.Data, originChainName, blockNumber); err != nil {
		return fmt.Errorf("fill execution failed: %w", err)
	}
	if err := f.SettleOrder(ctx, args, intent.Data, originChainName); err != nil {
		return fmt.Errorf("order settlement failed: %w", err)
	}
	return nil
}

func (f *Hyperlane7683Filler) Fill(ctx context.Context, args types.ParsedArgs, data types.IntentData, originChainName string, blockNumber uint64) error {
	fmt.Printf("🔵 Filling Intent: %s-%s on chain %s (block %d)\n", f.metadata.ProtocolName, args.OrderID, originChainName, blockNumber)
	fmt.Printf("   Fill Instructions: %d instructions\n", len(data.FillInstructions))
	fmt.Printf("   Max Spent: %d outputs\n", len(data.MaxSpent))

	for i, instruction := range data.FillInstructions {
		settlerAddr := instruction.DestinationSettler
		fmt.Printf("   📦 Instruction %d: Chain %s, Settler %s\n", i+1, instruction.DestinationChainID.String(), settlerAddr.Hex())

		client, err := f.getClientForChain(instruction.DestinationChainID)
		if err != nil {
			return fmt.Errorf("failed to get client for chain %s: %w", instruction.DestinationChainID.String(), err)
		}
		signer, err := f.getSignerForChain(instruction.DestinationChainID)
		if err != nil {
			return fmt.Errorf("failed to get signer for chain %s: %w", instruction.DestinationChainID.String(), err)
		}

		if i < len(data.MaxSpent) {
			maxSpent := data.MaxSpent[i]
			fmt.Printf("   💰 MaxSpent[%d]: Token=%s, Amount=%s, Recipient=%s, ChainID=%s\n", i, maxSpent.Token.Hex(), maxSpent.Amount.String(), maxSpent.Recipient.Hex(), maxSpent.ChainID.String())
		}

		orderIdBytes := common.FromHex(args.OrderID)
		var orderIdArr [32]byte
		copy(orderIdArr[:], orderIdBytes)
		originDataBytes := instruction.OriginData
		fillerAddressBytes := common.LeftPadBytes(signer.From.Bytes(), 32)

		fmt.Printf("   🔄 Executing fill call to contract %s on chain %s\n", settlerAddr.Hex(), instruction.DestinationChainID.String())
		// Use generated bindings for Fill
		contract, err := contracts.NewHyperlane7683(settlerAddr, client)
		if err != nil { return fmt.Errorf("failed to bind contract at %s: %w", settlerAddr.Hex(), err) }
		// Force legacy tx (type 0) by setting GasPrice
		if gp, gpErr := client.SuggestGasPrice(ctx); gpErr == nil { signer.GasPrice = gp }
		tx, err := contract.Fill(signer, orderIdArr, originDataBytes, fillerAddressBytes)
		if err != nil { return fmt.Errorf("failed to send fill tx: %w", err) }
		receipt, err := bind.WaitMined(ctx, client, tx)
		if err != nil { return fmt.Errorf("failed to wait for fill confirmation: %w", err) }
		if receipt.Status == 0 { return fmt.Errorf("fill transaction failed at block %d", receipt.BlockNumber) }
		fmt.Printf("   ✅ Fill transaction confirmed at block %d\n", receipt.BlockNumber)
	}
	fmt.Printf("   🎉 All fill instructions processed\n")
	return nil
}

func (f *Hyperlane7683Filler) SettleOrder(ctx context.Context, args types.ParsedArgs, data types.IntentData, originChainName string) error { return nil }

func (f *Hyperlane7683Filler) AddDefaultRules() {
	f.AddRule(f.filterByTokenAndAmount)
	f.AddRule(f.intentNotFilled)
}

func (f *Hyperlane7683Filler) filterByTokenAndAmount(args types.ParsedArgs, _ *filler.FillerContext) error { return nil }

func (f *Hyperlane7683Filler) intentNotFilled(args types.ParsedArgs, _ *filler.FillerContext) error {
	if len(args.ResolvedOrder.FillInstructions) == 0 { return fmt.Errorf("no fill instructions found") }
	first := args.ResolvedOrder.FillInstructions[0]
	settlerAddr := first.DestinationSettler
	client, err := f.getClientForChain(first.DestinationChainID)
	if err != nil { return fmt.Errorf("failed to get client for chain %s: %w", first.DestinationChainID.String(), err) }
	// Pack orderStatus via ABI for safety
	orderStatusABI := `[{"type":"function","name":"orderStatus","inputs":[{"type":"bytes32","name":"orderId"}],"outputs":[{"type":"bytes32","name":""}],"stateMutability":"view"}]`
	parsedABI, err := abi.JSON(strings.NewReader(orderStatusABI))
	if err != nil { return fmt.Errorf("failed to parse orderStatus ABI: %w", err) }
	// Convert orderId hex string to [32]byte
	var orderIdArr [32]byte
	copy(orderIdArr[:], common.LeftPadBytes(common.FromHex(args.OrderID), 32))
	callData, err := parsedABI.Pack("orderStatus", orderIdArr)
	if err != nil { return fmt.Errorf("failed to pack orderStatus call: %w", err) }
	result, err := client.CallContract(context.Background(), ethereum.CallMsg{ To: &settlerAddr, Data: callData }, nil)
	if err != nil { return fmt.Errorf("failed to call orderStatus: %w", err) }
	if len(result) < 32 { return fmt.Errorf("invalid orderStatus result length: %d", len(result)) }
	orderStatus := common.BytesToHash(result[:32])
	if orderStatus != UnknownOrderStatus { return ErrIntentAlreadyFilled }
	return nil
}

func (f *Hyperlane7683Filler) getClientForChain(chainID *big.Int) (*ethclient.Client, error) {
	chainIDUint := chainID.Uint64()
	if client, ok := f.clients[chainIDUint]; ok { return client, nil }
	rpcURL, err := config.GetRPCURLByChainID(chainIDUint)
	if err != nil { return nil, fmt.Errorf("failed to get RPC URL for chain %d: %w", chainIDUint, err) }
	client, err := ethclient.Dial(rpcURL)
	if err != nil { return nil, fmt.Errorf("failed to connect to chain %d at %s: %w", chainIDUint, rpcURL, err) }
	f.clients[chainIDUint] = client
	return client, nil
}

func (f *Hyperlane7683Filler) getSignerForChain(chainID *big.Int) (*bind.TransactOpts, error) {
	chainIDUint := chainID.Uint64()
	if signer, ok := f.signers[chainIDUint]; ok { return signer, nil }
	solverPrivateKey := os.Getenv("SOLVER_PRIVATE_KEY")
	if solverPrivateKey == "" { return nil, fmt.Errorf("SOLVER_PRIVATE_KEY environment variable not set") }
	pk, err := ethutil.ParsePrivateKey(solverPrivateKey)
	if err != nil { return nil, fmt.Errorf("failed to parse solver private key: %w", err) }
	from := crypto.PubkeyToAddress(pk.PublicKey)
	signer := bind.NewKeyedTransactor(pk)
	signer.From = from
	f.signers[chainIDUint] = signer
	return signer, nil
}

func (f *Hyperlane7683Filler) Close() error {
	for _, client := range f.clients { client.Close() }
	f.clients = make(map[uint64]*ethclient.Client)
	f.signers = make(map[uint64]*bind.TransactOpts)
	return nil
}


