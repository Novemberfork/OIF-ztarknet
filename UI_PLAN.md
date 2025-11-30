# UI Implementation Plan for Ztarknet OIF Bridge

## Overview

This plan outlines the implementation of a complete bridge UI for the Ztarknet OIF solver, adapting patterns from `oif-ui-starter` to work with the Go-based `solver` implementation. The goal is to enable users to bridge assets from EVM chains (Ethereum Sepolia) to Ztarknet (private Starknet fork).

## Current State Analysis

### What Exists in `ztarknet-oif-bridge`
- Dual wallet connection (EVM via Wagmi, Starknet via @starknet-react)
- Basic bridge form UI with amount/recipient inputs
- Chain configuration for Starknet Sepolia, Ztarknet Testnet, Mainnet
- ERC20 hook for balance reading
- Orange-themed styling aligned with Starknet branding

### What's Missing
- Contract interaction (Hyperlane7683, Permit2)
- Intent/order creation flow
- Fee estimation
- Transaction submission and confirmation
- Order fulfillment monitoring
- Transaction history
- Error handling

---

## Architecture

### Data Flow

```
User Input (BridgeForm)
    ↓
Validation (amount, recipient, balances)
    ↓
Fee Estimation (query solver or estimate gas)
    ↓
Token Approval (ERC20 approve to Hyperlane7683)
    ↓
Open Intent (call Hyperlane7683::open on origin chain)
    ↓
Monitor Fulfillment (poll Ztarknet for Filled event)
    ↓
Update UI (show success, update history)
```

### Key Contracts (from solver config)

| Contract | Chain | Purpose |
|----------|-------|---------|
| Hyperlane7683 | EVM Origin | Intent opening, settlement |
| Hyperlane7683 | Ztarknet | Fill execution |
| MockERC20 | Ztarknet | Test token |
| Permit2 | Ztarknet | Gas-efficient approvals |

---

## Implementation Phases

### Phase 1: Contract Integration Setup

**Goal**: Get real contract ABIs and addresses configured

**Tasks**:
1. Extract Hyperlane7683 ABI from solver (`solver/solvercore/contracts/hyperlane7683.go`)
2. Create `src/abis/Hyperlane7683.json` with the ABI
3. Add Permit2 ABI if using permit-based approvals
4. Update `src/config/contracts.ts` with:
   - EVM Sepolia Hyperlane7683 address
   - Ztarknet Hyperlane7683 address (0x06508892543f6dd254cab6f166e16b4e146743cfaedde9afaa2931c18a335f22)
   - MockERC20 address (0x067c9b63ecb6a191e369a461ab05cf9a4d08093129e5ac8eedb71d4908e4cc5b)
   - Token addresses for EVM origin chains

**Files to Create/Modify**:
- `src/abis/Hyperlane7683.json` (new)
- `src/config/contracts.ts` (update)

---

### Phase 2: Types & Interfaces

**Goal**: Define TypeScript types matching solver data structures

**Tasks**:
1. Create order types matching solver's `ResolvedCrossChainOrder`
2. Define transfer status enum
3. Create fee quote types
4. Define transaction context for history

**Types to Add** (`src/types/`):

```typescript
// orders.ts
interface Output {
  token: string;
  amount: bigint;
  recipient: string;
  chainId: bigint;
}

interface FillInstruction {
  destinationChainId: bigint;
  destinationSettler: string;
  originData: string;
}

interface ResolvedCrossChainOrder {
  user: string;
  originChainId: bigint;
  openDeadline: number;
  fillDeadline: number;
  orderId: string;
  maxSpent: Output[];
  minReceived: Output[];
  fillInstructions: FillInstruction[];
}

// transfers.ts
enum TransferStatus {
  Idle = 'idle',
  Preparing = 'preparing',
  WaitingApproval = 'waiting_approval',
  Approving = 'approving',
  WaitingSignature = 'waiting_signature',
  Submitting = 'submitting',
  WaitingConfirmation = 'waiting_confirmation',
  WaitingFulfillment = 'waiting_fulfillment',
  Fulfilled = 'fulfilled',
  Failed = 'failed'
}

interface TransferContext {
  status: TransferStatus;
  originChain: string;
  destinationChain: string;
  token: string;
  amount: string;
  recipient: string;
  sender: string;
  originTxHash?: string;
  orderId?: string;
  fillTxHash?: string;
  timestamp: number;
  error?: string;
}

interface FeeQuote {
  gasEstimate: bigint;
  gasPrice: bigint;
  totalFee: bigint;
  formattedFee: string;
}
```

---

### Phase 3: Hooks Development

**Goal**: Create reusable hooks for contract interaction

#### 3.1 useHyperlane7683 Hook

**Purpose**: Interact with Hyperlane7683 contract for opening intents

**File**: `src/hooks/useHyperlane7683.ts`

**Functions**:
- `openOrder(orderData)` - Submit new intent
- `getOrderStatus(orderId)` - Check order status
- `estimateGas(orderData)` - Estimate gas for opening

**Implementation Pattern** (from oif-ui-starter):
```typescript
export function useHyperlane7683() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const openOrder = async (params: OpenOrderParams) => {
    // 1. Encode order data
    // 2. Estimate gas
    // 3. Send transaction
    // 4. Return tx hash and orderId
  };

  return { openOrder, getOrderStatus, estimateGas };
}
```

#### 3.2 useTokenApproval Hook

**Purpose**: Handle ERC20 approvals before bridging

**File**: `src/hooks/useTokenApproval.ts`

**Functions**:
- `checkAllowance(token, spender)` - Check current allowance
- `approve(token, spender, amount)` - Approve spending
- `isApprovalNeeded(token, spender, amount)` - Boolean check

#### 3.3 useOrderStatus Hook

**Purpose**: Poll for order fulfillment on destination chain

**File**: `src/hooks/useOrderStatus.ts`

**Functions**:
- `watchOrder(orderId)` - Start polling for Filled event
- `stopWatching()` - Cancel polling
- `status` - Current order status

**Implementation**:
```typescript
export function useOrderStatus(orderId: string | null) {
  const [status, setStatus] = useState<'pending' | 'filled' | 'settled'>('pending');

  useEffect(() => {
    if (!orderId) return;

    const interval = setInterval(async () => {
      // Query Ztarknet for Filled event with orderId
      const filled = await checkOrderFilled(orderId);
      if (filled) {
        setStatus('filled');
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [orderId]);

  return { status };
}
```

#### 3.4 useFeeEstimate Hook

**Purpose**: Get gas estimates for transactions

**File**: `src/hooks/useFeeEstimate.ts`

---

### Phase 4: State Management

**Goal**: Implement Zustand store for app state (adapting oif-ui-starter pattern)

**File**: `src/store/index.ts`

**Store Structure**:
```typescript
interface AppState {
  // Transfer state
  currentTransfer: TransferContext | null;
  setCurrentTransfer: (transfer: TransferContext | null) => void;
  updateTransferStatus: (status: TransferStatus, data?: Partial<TransferContext>) => void;

  // History
  transfers: TransferContext[];
  addTransfer: (transfer: TransferContext) => void;

  // UI state
  isTransferLoading: boolean;
  setTransferLoading: (loading: boolean) => void;
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;

  // Fee quotes
  feeQuote: FeeQuote | null;
  setFeeQuote: (quote: FeeQuote | null) => void;
}
```

**Persistence**:
- Persist `transfers` array to localStorage
- Use Zustand persist middleware

---

### Phase 5: Bridge Form Enhancement

**Goal**: Upgrade BridgeForm with transaction flow

**File**: `src/components/bridge/BridgeForm.tsx`

**Enhancements**:

1. **Two-stage flow** (matching oif-ui-starter):
   - Input mode: Select chain, token, amount, recipient
   - Review mode: Show fee breakdown, confirm transaction

2. **Fee display**:
   - Add fee estimate section before submit button
   - Show gas estimate in origin token
   - Show any solver/protocol fees

3. **Transaction flow**:
   ```
   handleBridge() →
     1. Check approval needed
     2. If needed, show "Approve" button
     3. After approval, show "Bridge" button
     4. On bridge click:
        - Prepare order data
        - Call openOrder()
        - Update UI with pending status
        - Start polling for fulfillment
   ```

4. **Status display**:
   - Add TransactionStatus component inline
   - Show step-by-step progress
   - Display tx hashes with explorer links

**New Sub-components**:
- `ReviewSection.tsx` - Fee breakdown and confirmation
- `TransactionProgress.tsx` - Step indicator with status
- `ApprovalButton.tsx` - Handle token approvals

---

### Phase 6: Transaction Status Component

**Goal**: Create detailed transaction status display

**File**: `src/components/bridge/TransactionStatus.tsx`

**Features**:
- Multi-step progress indicator
- Status icons (pending, success, error)
- Transaction hash links to explorers
- Estimated time remaining (optional)
- Error messages with retry option

**Steps to Display**:
1. Preparing transaction
2. Waiting for approval signature (if needed)
3. Confirming approval (if needed)
4. Waiting for bridge signature
5. Confirming on origin chain
6. Waiting for solver fulfillment
7. Completed

---

### Phase 7: Transfer History

**Goal**: Add transfer history sidebar (from oif-ui-starter)

**Files**:
- `src/components/history/HistoryPanel.tsx`
- `src/components/history/TransferItem.tsx`
- `src/components/history/TransferDetails.tsx`

**Features**:
- Slide-out sidebar panel
- List of past transfers
- Status badges (pending, fulfilled, failed)
- Click to expand details
- Links to explorers for both chains

---

### Phase 8: Error Handling

**Goal**: Comprehensive error handling and user feedback

**Implementation**:

1. **Toast notifications** - Use react-toastify (already common in React apps)
   - Success: Transaction submitted, fulfilled
   - Error: Rejection, insufficient balance, contract errors
   - Info: Waiting for confirmation

2. **Form validation errors**:
   - Insufficient balance
   - Invalid recipient address
   - Amount too low/high
   - Network mismatch

3. **Transaction errors**:
   - User rejection
   - Gas estimation failure
   - Contract revert (decode error message)
   - Timeout

**File**: `src/utils/errors.ts`
```typescript
function parseContractError(error: unknown): string {
  // Parse Wagmi/Viem errors
  // Return human-readable message
}
```

---

### Phase 9: Testing & Validation

**Goal**: End-to-end testing on testnets

**Test Scenarios**:
1. Connect EVM wallet (Sepolia)
2. Connect Starknet wallet
3. Approve test tokens
4. Submit bridge transaction
5. Wait for fulfillment
6. Verify tokens received on Ztarknet

**Test Tokens**:
- Use MockERC20 on both chains
- Faucet integration or manual funding

---

### Phase 10: Polish & Deployment

**Goal**: Production-ready UI

**Tasks**:
1. Add loading skeletons
2. Mobile responsiveness
3. Add .env.example with required variables
4. Environment-based configuration (testnet/mainnet)
5. Build optimization
6. Deploy to Vercel/Netlify

---

## File Structure (Final)

```
src/
├── abis/
│   ├── ERC20.json
│   ├── Hyperlane7683.json
│   └── Permit2.json
├── components/
│   ├── bridge/
│   │   ├── BridgeForm.tsx (enhanced)
│   │   ├── ReviewSection.tsx (new)
│   │   ├── TransactionProgress.tsx (new)
│   │   ├── TransactionStatus.tsx (new)
│   │   └── ApprovalButton.tsx (new)
│   ├── history/
│   │   ├── HistoryPanel.tsx (new)
│   │   ├── TransferItem.tsx (new)
│   │   └── TransferDetails.tsx (new)
│   ├── wallet/
│   │   ├── WalletButton.tsx
│   │   ├── AccountDisplay.tsx
│   │   └── NetworkSwitcher.tsx
│   └── ui/
│       ├── Toast.tsx (new)
│       └── LoadingSpinner.tsx (new)
├── config/
│   ├── chains.ts
│   └── contracts.ts (updated)
├── hooks/
│   ├── useERC20.ts
│   ├── useHyperlane7683.ts (new)
│   ├── useTokenApproval.ts (new)
│   ├── useOrderStatus.ts (new)
│   ├── useFeeEstimate.ts (new)
│   └── useTransactionStatus.ts
├── store/
│   └── index.ts (new)
├── types/
│   ├── contracts.ts
│   ├── orders.ts (new)
│   └── transfers.ts (new)
├── utils/
│   ├── errors.ts (new)
│   ├── format.ts (new)
│   └── addresses.ts (new)
├── App.tsx
├── App.css
├── main.tsx
└── index.css
```

---

## Key Differences from oif-ui-starter

| Aspect | oif-ui-starter | ztarknet-oif-bridge |
|--------|---------------|---------------------|
| Framework | Next.js | React + Vite |
| State | Zustand | Zustand (to add) |
| Forms | Formik | Native React |
| Wallet (EVM) | RainbowKit | Wagmi only |
| Wallet (Starknet) | N/A (Cosmos) | @starknet-react |
| Backend | WarpCore SDK | Direct contract calls |
| Fee Quotes | warpCore.estimateTransferRemoteFees() | Manual gas estimation |
| Order Monitoring | warpCore event polling | Direct event query |

---

## Environment Variables

```env
# RPC URLs
VITE_ETHEREUM_RPC_URL=
VITE_SEPOLIA_RPC_URL=
VITE_ZTARKNET_RPC_URL=http://188.34.188.124:6060

# Contract Addresses (per network)
VITE_SEPOLIA_HYPERLANE7683=
VITE_ZTARKNET_HYPERLANE7683=0x06508892543f6dd254cab6f166e16b4e146743cfaedde9afaa2931c18a335f22
VITE_ZTARKNET_MOCK_ERC20=0x067c9b63ecb6a191e369a461ab05cf9a4d08093129e5ac8eedb71d4908e4cc5b

# Optional
VITE_WALLET_CONNECT_PROJECT_ID=
```

---

## Priority Order

1. **Phase 1-2**: Contract setup and types (foundation)
2. **Phase 3**: Hooks development (core functionality)
3. **Phase 5**: Bridge form enhancement (user-facing)
4. **Phase 6**: Transaction status (user feedback)
5. **Phase 4**: State management (persistence)
6. **Phase 7**: Transfer history (nice-to-have)
7. **Phase 8-10**: Polish (production-ready)

---

## Estimated Complexity

| Phase | Complexity | Dependencies |
|-------|------------|--------------|
| 1 | Low | Solver contract artifacts |
| 2 | Low | None |
| 3 | High | Phases 1-2 |
| 4 | Medium | Phase 2 |
| 5 | High | Phases 3-4 |
| 6 | Medium | Phase 4 |
| 7 | Medium | Phase 4 |
| 8 | Medium | Phases 5-6 |
| 9 | Medium | All above |
| 10 | Low | All above |

---

## References

- Solver source: `/solver/` directory
- oif-ui-starter patterns: `/oif-ui-starter/src/features/`
- Current UI: `/ztarknet-oif-bridge/src/`
- Hyperlane 7683 spec: Event-based order lifecycle (Open → Fill → Settle)
