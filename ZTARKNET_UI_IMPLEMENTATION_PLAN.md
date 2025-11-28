# Starknet OIF Bridge - TanStack Start Implementation Plan

## Overview
This document outlines the implementation plan for building a **Starknet-focused** cross-chain intent bridge UI from scratch using **TanStack Start**. The goal is to enable cross-chain intent filling between EVM chains and Starknet using the existing Cairo contracts and Hyperlane infrastructure.

## Project Details
- **Project Name**: `starknet-oif-bridge`
- **Framework**: TanStack Start (v1.x)
- **Primary Chain**: Starknet (Mainnet, Sepolia, zStarknet)
- **Cross-chain Support**: EVM chains via Hyperlane (Optimism, Arbitrum, Base)

## Current State
- **UI**: New TanStack Start project (to be created)
- **Contracts**: Cairo contracts exist in `/cairo/` including Hyperlane7683, MockERC20, and Permit2
- **Infrastructure**: Hyperlane solver supports cross-chain messaging to Starknet
- **Reference UI**: oif-ui-starter (Next.js multi-chain UI) - used for UX patterns only

## Implementation Phases

---

## Phase 1: Project Initialization

### 1.1 Create TanStack Start Project
Initialize a new TanStack Start project:

```bash
# Navigate to project directory
cd starknet-oif-bridge

# Initialize TanStack Start (if not already done)
npm create @tanstack/start@latest

# Or if basic project exists, verify structure
ls -la
```

**Expected structure:**
```
starknet-oif-bridge/
├── app/
│   ├── routes/
│   │   └── __root.tsx
│   └── client.tsx
├── app.config.ts
├── package.json
└── tsconfig.json
```

**Task checklist:**
- [ ] Verify TanStack Start project is initialized
- [ ] Confirm app/ directory structure exists
- [ ] Test dev server runs (`npm run dev`)

### 1.2 Install Core Dependencies
Add required packages to `package.json`:

```json
{
  "dependencies": {
    "@tanstack/react-router": "^1.90.0",
    "@tanstack/start": "^1.90.0",
    "vinxi": "^0.5.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "starknet": "^6.0.0",
    "@starknet-react/core": "^2.8.0",
    "@starknet-react/chains": "^0.1.0",
    "starknetkit": "^1.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0"
  }
}
```

**Core libraries:**
- `starknet`: Official Starknet.js SDK for contract interactions
- `@starknet-react/core`: React hooks for Starknet wallet and contracts
- `@starknet-react/chains`: Chain configurations (mainnet, sepolia)
- `starknetkit`: Modern wallet connector (Argent X, Braavos, etc.)

**Task checklist:**
- [ ] Install dependencies: `npm install`
- [ ] Verify no version conflicts
- [ ] Test that TypeScript compilation works

### 1.3 TypeScript Configuration
Update `tsconfig.json` for optimal setup:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@/*": ["./app/*"]
    }
  },
  "include": ["app/**/*"],
  "exclude": ["node_modules"]
}
```

**Task checklist:**
- [ ] Update tsconfig.json
- [ ] Add path aliases (@/* for app/)
- [ ] Verify TypeScript server restarts

---

## Phase 2: Wallet Integration

### 2.1 Configure Root Layout with Starknet Provider
**File:** `app/routes/__root.tsx`

Set up the root layout with StarknetConfig provider:

```typescript
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { StarknetConfig, publicProvider } from '@starknet-react/core';
import { mainnet, sepolia } from '@starknet-react/chains';
import { InjectedConnector } from 'starknetkit/injected';
import { ArgentMobileConnector } from 'starknetkit/argentMobile';
import { WebWalletConnector } from 'starknetkit/webwallet';

// Wallet connectors
const connectors = [
  new InjectedConnector({ options: { id: 'argentX' }}),
  new InjectedConnector({ options: { id: 'braavos' }}),
  new ArgentMobileConnector(),
  new WebWalletConnector({ url: 'https://web.argent.xyz' }),
];

// Custom zStarknet chain config
const zstarknet = {
  id: 'zstarknet',
  network: 'zstarknet',
  name: 'zStarknet Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://188.34.188.124:6060'] },
    public: { http: ['http://188.34.188.124:6060'] },
  },
  testnet: true,
};

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <StarknetConfig
      chains={[mainnet, sepolia, zstarknet]}
      provider={publicProvider()}
      connectors={connectors}
      autoConnect
    >
      <div className="app">
        <Outlet />
      </div>
    </StarknetConfig>
  );
}
```

**Implementation tasks:**
- [ ] Create `app/routes/__root.tsx`
- [ ] Configure StarknetConfig with wallet connectors
- [ ] Add Starknet chains (mainnet, sepolia, zstarknet)
- [ ] Enable autoConnect for better UX
- [ ] Test wallet provider is accessible in child routes

### 2.2 Create Wallet Connection Components
**File:** `app/components/wallet/WalletButton.tsx`

```typescript
import { useAccount, useConnect, useDisconnect } from '@starknet-react/core';

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="wallet-connected">
        <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    );
  }

  return (
    <div className="wallet-select">
      {connectors.map((connector) => (
        <button
          key={connector.id}
          onClick={() => connect({ connector })}
          disabled={!connector.available()}
        >
          Connect {connector.name}
        </button>
      ))}
    </div>
  );
}
```

**File:** `app/components/wallet/AccountDisplay.tsx`

```typescript
import { useAccount, useBalance, useNetwork } from '@starknet-react/core';

export function AccountDisplay() {
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const { data: balance, isLoading } = useBalance({
    address,
    token: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH
    watch: true,
  });

  if (!isConnected) return null;

  return (
    <div className="account-info">
      <div className="chain-badge">{chain?.name || 'Unknown'}</div>
      <div className="address">{address?.slice(0, 10)}...</div>
      {!isLoading && balance && (
        <div className="balance">
          {(Number(balance.value) / 1e18).toFixed(4)} ETH
        </div>
      )}
    </div>
  );
}
```

**Implementation tasks:**
- [ ] Create `app/components/wallet/WalletButton.tsx`
- [ ] Create `app/components/wallet/AccountDisplay.tsx`
- [ ] Add wallet modal/dropdown UI
- [ ] Handle connection states (connecting, connected, disconnected)
- [ ] Show network badge with chain name
- [ ] Display ETH balance on Starknet
- [ ] Add error handling for connection failures

### 2.3 Create Network Switcher
**File:** `app/components/wallet/NetworkSwitcher.tsx`

```typescript
import { useNetwork, useSwitchChain } from '@starknet-react/core';

export function NetworkSwitcher() {
  const { chain } = useNetwork();
  const { switchChain, chains } = useSwitchChain();

  return (
    <select
      value={chain?.id}
      onChange={(e) => {
        const targetChain = chains.find((c) => c.id === e.target.value);
        if (targetChain) switchChain({ chainId: targetChain.id });
      }}
    >
      {chains.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
```

**Tasks:**
- [ ] Create network switcher component
- [ ] Test switching between mainnet/sepolia/zstarknet
- [ ] Handle wallet network mismatch warnings
- [ ] Update UI when network changes

---

## Phase 3: Chain Configuration

### 3.1 Define Starknet Chain Metadata
**File:** `src/consts/chains.ts`

Add Starknet chain configurations:

```typescript
import { ChainMetadata, ProtocolType } from '@hyperlane-xyz/sdk';

export const starknetChains: Record<string, ChainMetadata> = {
  starknet: {
    name: 'Starknet',
    displayName: 'Starknet',
    protocol: ProtocolType.Ethereum, // Or custom 'starknet' if Hyperlane supports
    chainId: 23448594291968334, // SN_MAIN chain ID
    domainId: 23448594291968334,
    nativeToken: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: [
      { http: 'https://starknet-mainnet.public.blastapi.io' },
      { http: 'https://rpc.starknet.lava.build' }
    ],
    blockExplorers: [
      {
        name: 'Starkscan',
        url: 'https://starkscan.co',
        apiUrl: 'https://api.starkscan.co/api/v0',
      },
      {
        name: 'Voyager',
        url: 'https://voyager.online',
      }
    ],
  },
  starknetSepolia: {
    name: 'starknetSepolia',
    displayName: 'Starknet Sepolia',
    protocol: ProtocolType.Ethereum,
    chainId: 2036661089190289815, // SN_SEPOLIA chain ID
    domainId: 2036661089190289815,
    nativeToken: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      { http: 'https://starknet-sepolia.public.blastapi.io' }
    ],
    blockExplorers: [
      {
        name: 'Starkscan Sepolia',
        url: 'https://sepolia.starkscan.co',
      }
    ],
    isTestnet: true,
  },
  zstarknet: {
    name: 'zstarknet',
    displayName: 'zStarknet Testnet',
    protocol: ProtocolType.Ethereum,
    chainId: 1, // Update with actual zStarknet chain ID
    domainId: 1, // Update with Hyperlane domain ID
    nativeToken: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      { http: 'http://188.34.188.124:6060' } // From ZTARKNET.md
    ],
    blockExplorers: [
      {
        name: 'zStarknet Explorer',
        url: 'https://explorer.zstarknet.io', // Update if exists
      }
    ],
    isTestnet: true,
  }
};
```

**Tasks:**
- [ ] Create chain metadata objects
- [ ] Verify chain IDs from contracts/docs
- [ ] Configure RPC endpoints
- [ ] Add block explorer URLs
- [ ] Test RPC connectivity
- [ ] Merge with existing chain configs

### 3.2 Update Chain Registry
**File:** `src/consts/chainMetadata.ts` (or create if doesn't exist)

```typescript
import { starknetChains } from './chains';
import { ChainMap, ChainMetadata } from '@hyperlane-xyz/sdk';

export const chains: ChainMap<ChainMetadata> = {
  ...existingChains,
  ...starknetChains,
};
```

---

## Phase 4: Token & Warp Route Configuration

### 4.1 Add Starknet Tokens
**File:** `src/consts/warpRoutes.ts`

Add Starknet token configurations:

```typescript
export const warpRouteConfig: WarpCoreConfig = {
  tokens: [
    // ... existing EVM tokens
    {
      chainName: 'starknetSepolia',
      standard: TokenStandard.EvmHypNative, // Or custom Starknet standard
      decimals: 18,
      symbol: 'ETH',
      name: 'Ether',
      addressOrDenom: '0x...', // Hyperlane7683 contract address
      connections: [
        { token: 'ethereum|optimismSepolia|0x...' },
        { token: 'ethereum|baseSepolia|0x...' },
        { token: 'ethereum|arbitrumSepolia|0x...' },
      ],
    },
    {
      chainName: 'zstarknet',
      standard: TokenStandard.EvmHypNative,
      decimals: 18,
      symbol: 'ETH',
      name: 'Ether',
      addressOrDenom: '0x...', // From cairo deployment
      connections: [
        // Cross-chain routes
      ],
    },
    // Add custom intent tokens if needed
  ],
};
```

**Tasks:**
- [ ] Get deployed contract addresses from `/cairo/` deployments
- [ ] Define token standards for Starknet (may need custom type)
- [ ] Configure warp route connections
- [ ] Add metadata (logos, descriptions)
- [ ] Test token data parsing

### 4.2 Create Token Standard Handler
**File:** `src/features/tokens/StarknetTokenAdapter.ts`

Handle Starknet-specific token operations:

```typescript
import { Contract, cairo } from 'starknet';

export class StarknetTokenAdapter {
  async getBalance(tokenAddress: string, accountAddress: string): Promise<bigint> {
    // ERC20 balanceOf call
  }

  async transfer(to: string, amount: bigint): Promise<string> {
    // ERC20 transfer
  }

  async approve(spender: string, amount: bigint): Promise<string> {
    // ERC20 approve
  }
}
```

---

## Phase 5: Contract Integration

### 5.1 Import Cairo Contract ABIs
**Directory:** `src/abis/starknet/`

Create ABI files for:
- [ ] `Hyperlane7683.json` - Main cross-chain intent contract
- [ ] `MockERC20.json` - Token contract
- [ ] `Permit2.json` - Permit functionality
- [ ] `IHyperlaneMailbox.json` - Hyperlane messaging

**Source:** Extract from `/cairo/target/dev/` compiled contracts

### 5.2 Create Contract Interaction Hooks
**File:** `src/features/contracts/useStarknetContracts.ts`

```typescript
import { useContract } from '@starknet-react/core';
import Hyperlane7683Abi from '@/abis/starknet/Hyperlane7683.json';

export function useHyperlane7683Contract(address: string) {
  const { contract } = useContract({
    abi: Hyperlane7683Abi,
    address,
  });

  return {
    async submitIntent(intentData: IntentData) {
      // Call submit_intent function
    },
    async getIntent(intentId: string) {
      // Call get_intent function
    },
    async fulfillIntent(intentId: string, proof: any) {
      // Call fulfill_intent function
    },
  };
}
```

**Tasks:**
- [ ] Create hooks for each contract type
- [ ] Implement read functions (getters)
- [ ] Implement write functions (transactions)
- [ ] Add error handling
- [ ] Add transaction status tracking
- [ ] Test contract calls on testnet

### 5.3 Intent Submission Flow
**File:** `src/features/intents/StarknetIntentSubmitter.tsx`

Build UI for submitting cross-chain intents:

```typescript
interface IntentParams {
  destinationChain: string;
  token: string;
  amount: bigint;
  recipient: string;
  deadline: number;
}

export function StarknetIntentSubmitter() {
  const { account } = useAccount();
  const hyperlaneContract = useHyperlane7683Contract(CONTRACT_ADDRESS);

  const submitIntent = async (params: IntentParams) => {
    // 1. Approve token spending (if needed)
    // 2. Call submit_intent on Hyperlane7683
    // 3. Wait for transaction confirmation
    // 4. Return intent ID
  };

  return (
    // Intent submission form
  );
}
```

---

## Phase 6: Bridge UI Components

### 6.1 Update Transfer Form
**File:** `src/features/transfer/TransferTokenForm.tsx`

Modifications needed:
- [ ] Add Starknet to source chain dropdown
- [ ] Add Starknet to destination chain dropdown
- [ ] Handle Starknet address format validation (0x0... 64 chars)
- [ ] Add Starknet-specific fee estimation
- [ ] Update transfer flow for Starknet transactions

### 6.2 Create Starknet Address Input
**File:** `src/components/input/StarknetAddressInput.tsx`

```typescript
export function StarknetAddressInput({ value, onChange }: Props) {
  const validateAddress = (addr: string) => {
    // Starknet address: 0x followed by up to 64 hex chars
    return /^0x[0-9a-fA-F]{1,64}$/.test(addr);
  };

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => {
        const addr = e.target.value;
        if (validateAddress(addr)) {
          onChange(addr);
        }
      }}
      placeholder="0x0..."
    />
  );
}
```

### 6.3 Transaction Status Tracker
**File:** `src/features/transactions/StarknetTxTracker.tsx`

Track transaction status with polling:

```typescript
import { useTransaction } from '@starknet-react/core';

export function StarknetTxTracker({ txHash }: { txHash: string }) {
  const { data: tx, isLoading } = useTransaction({ hash: txHash });

  return (
    <div>
      <p>Status: {tx?.status}</p>
      <a href={`https://starkscan.co/tx/${txHash}`}>View on Explorer</a>
    </div>
  );
}
```

---

## Phase 7: Hyperlane Integration

### 7.1 Configure Hyperlane SDK for Starknet
**File:** `src/features/hyperlane/config.ts`

Update Hyperlane configuration:

```typescript
import { HyperlaneCore } from '@hyperlane-xyz/sdk';

export const hyperlaneConfig = {
  chains: {
    // ... existing chains
    starknetSepolia: {
      mailbox: '0x...', // Deployed Hyperlane mailbox on Starknet
      interchainGasPaymaster: '0x...',
      validatorAnnounce: '0x...',
    },
    zstarknet: {
      mailbox: '0x...', // From cairo deployment
      interchainGasPaymaster: '0x...',
      validatorAnnounce: '0x...',
    },
  },
};
```

**Tasks:**
- [ ] Get Hyperlane contract addresses from deployments
- [ ] Configure mailbox connections
- [ ] Set up gas payment handling
- [ ] Test message passing to/from Starknet

### 7.2 Message Tracking
**File:** `src/features/hyperlane/useStarknetMessages.ts`

```typescript
export function useStarknetMessages() {
  const trackMessage = async (messageId: string) => {
    // Poll Hyperlane explorer API
    // Check delivery status on destination chain
    // Return status updates
  };

  return { trackMessage };
}
```

---

## Phase 8: Testing & Validation

### 8.1 Unit Tests
**Directory:** `src/__tests__/starknet/`

Test files to create:
- [ ] `StarknetWalletContext.test.tsx` - Wallet connection tests
- [ ] `useStarknetContracts.test.ts` - Contract interaction mocks
- [ ] `StarknetAddressInput.test.tsx` - Address validation
- [ ] `StarknetTokenAdapter.test.ts` - Token operations

### 8.2 Integration Tests
**File:** `src/__tests__/integration/starknet-bridge.test.tsx`

Test scenarios:
- [ ] Connect Argent X wallet
- [ ] Switch between Starknet networks
- [ ] Read token balance
- [ ] Submit cross-chain intent from Starknet to Optimism Sepolia
- [ ] Submit intent from Optimism to Starknet
- [ ] Track transaction status
- [ ] Verify Hyperlane message delivery

### 8.3 Manual Testing Checklist
- [ ] Connect all supported Starknet wallets (Argent X, Braavos)
- [ ] Test on Starknet Sepolia
- [ ] Test on zStarknet testnet
- [ ] Submit test intent with small amount
- [ ] Verify solver picks up and fulfills intent
- [ ] Check transaction on Starkscan
- [ ] Verify funds received on destination chain
- [ ] Test error cases (insufficient balance, network errors)
- [ ] Test wallet disconnection/reconnection
- [ ] Test network switching

---

## Phase 9: Documentation & Deployment

### 9.1 User Documentation
**File:** `docs/STARKNET_GUIDE.md`

Document:
- [ ] How to connect Starknet wallet
- [ ] Supported Starknet networks
- [ ] How to bridge tokens to/from Starknet
- [ ] Transaction fees and timing
- [ ] Troubleshooting common issues
- [ ] Wallet setup guides

### 9.2 Developer Documentation
**File:** `docs/STARKNET_DEVELOPMENT.md`

Include:
- [ ] Contract addresses and ABIs
- [ ] API reference for hooks
- [ ] Contract interaction patterns
- [ ] Testing guide
- [ ] Deployment procedures

### 9.3 Update README
**File:** `oif-ui-starter/README.md`

Add:
- [ ] Starknet support in features list
- [ ] Starknet setup instructions
- [ ] Link to Starknet guide

### 9.4 Deployment Configuration
**File:** `oif-ui-starter/.env.example`

```bash
# Starknet Configuration
NEXT_PUBLIC_STARKNET_MAINNET_RPC=https://starknet-mainnet.public.blastapi.io
NEXT_PUBLIC_STARKNET_SEPOLIA_RPC=https://starknet-sepolia.public.blastapi.io
NEXT_PUBLIC_ZSTARKNET_RPC=http://188.34.188.124:6060

# Starknet Contract Addresses
NEXT_PUBLIC_STARKNET_HYPERLANE_MAILBOX=0x...
NEXT_PUBLIC_STARKNET_INTENT_CONTRACT=0x...
```

---

## Phase 10: Optimization & Polish

### 10.1 Performance Optimization
- [ ] Implement transaction batching for multiple intents
- [ ] Add caching for contract reads
- [ ] Optimize RPC calls (batch requests)
- [ ] Add retry logic for failed transactions
- [ ] Implement transaction queueing

### 10.2 UX Improvements
- [ ] Add loading states for contract calls
- [ ] Show gas estimates before transaction
- [ ] Add transaction history view
- [ ] Implement toast notifications for tx status
- [ ] Add address book for frequent recipients
- [ ] Show estimated time to finality

### 10.3 Error Handling
- [ ] User-friendly error messages for common failures
- [ ] Wallet connection error recovery
- [ ] RPC failure fallback to alternative providers
- [ ] Transaction timeout handling
- [ ] Network mismatch warnings

---

## Technical Considerations

### Starknet-Specific Challenges

1. **Address Format Differences**
   - Starknet uses felt252 addresses (0x + up to 64 hex chars)
   - Need conversion utilities for Cairo <-> EVM address formats
   - Handle address padding/truncation correctly

2. **Transaction Flow**
   - Starknet has different tx lifecycle: Received -> Pending -> Accepted on L2 -> Accepted on L1
   - May require different UX for confirmation status
   - Finality time is different from EVM chains

3. **Fee Mechanism**
   - Starknet uses STRK or ETH for fees
   - Fee estimation is different from EVM gas estimation
   - Need to handle both fee tokens

4. **Cairo Contract ABI**
   - Cairo ABI format differs from Solidity
   - Need proper type conversion (felt252, u256, etc.)
   - Array and struct handling may differ

5. **Hyperlane Protocol Support**
   - Verify Hyperlane SDK supports Starknet as destination
   - May need custom adapter layer
   - Solver must support Starknet chain

### Dependencies on Other Components

1. **Cairo Contracts** (in `/cairo/`)
   - Must be deployed and verified on target networks
   - ABIs must be exported and up-to-date
   - Contract addresses documented

2. **Hyperlane Solver** (in `/solver/`)
   - Must support Starknet chain in solver logic
   - Must monitor Starknet events
   - Must be able to submit fulfillment txs on Starknet

3. **Hyperlane Infrastructure**
   - Validators must support Starknet
   - Relayers must support message passing to/from Starknet
   - ISM (Interchain Security Modules) configured

---

## Timeline Estimate

| Phase | Estimated Time | Dependencies |
|-------|----------------|--------------|
| Phase 1: Dependencies | 0.5 days | None |
| Phase 2: Wallet Integration | 2-3 days | Phase 1 |
| Phase 3: Chain Configuration | 1 day | Phase 1 |
| Phase 4: Token Configuration | 1-2 days | Phase 3, Cairo contracts deployed |
| Phase 5: Contract Integration | 3-4 days | Phase 2, Cairo ABIs available |
| Phase 6: Bridge UI | 3-4 days | Phase 2, 4, 5 |
| Phase 7: Hyperlane Integration | 2-3 days | Phase 5, Hyperlane deployed |
| Phase 8: Testing | 3-4 days | Phase 6, 7 |
| Phase 9: Documentation | 1-2 days | Phase 8 |
| Phase 10: Optimization | 2-3 days | Phase 8 |
| **Total** | **18-26 days** | |

---

## Success Criteria

The implementation will be considered complete when:

- [ ] Users can connect Starknet wallets (Argent X, Braavos)
- [ ] Users can view Starknet token balances
- [ ] Users can submit intents from Starknet to EVM chains
- [ ] Users can submit intents from EVM chains to Starknet
- [ ] Transactions are tracked and displayed correctly
- [ ] All tests pass (unit + integration)
- [ ] Documentation is complete and accurate
- [ ] UI is deployed and accessible on testnet
- [ ] At least 5 successful cross-chain intents completed on testnet

---

## Open Questions

1. **Hyperlane SDK Support**: Does `@hyperlane-xyz/sdk` currently support Starknet? May need custom implementation.
2. **Protocol Type**: Should Starknet use `ProtocolType.Ethereum` or a custom type in Hyperlane metadata?
3. **Token Standards**: What token standard should be used for Starknet tokens in warp routes?
4. **zStarknet RPC**: Is the zStarknet RPC stable and production-ready?
5. **Solver Readiness**: Does the Go solver in `/solver/` already support Starknet, or does it need updates?
6. **Contract Addresses**: Where are the deployed contract addresses documented?
7. **Fee Token**: Should the UI support STRK token for fees, or only ETH?

---

## Next Steps

1. Review this plan with the team
2. Answer open questions
3. Verify Cairo contract deployment status
4. Start Phase 1: Install dependencies
5. Set up development environment with Starknet testnet
6. Create GitHub issues for each phase
7. Assign ownership for each component

---

## References

- [Starknet Documentation](https://docs.starknet.io)
- [Starknet.js Docs](https://www.starknetjs.com/)
- [Starknet React Docs](https://starknet-react.com/)
- [Hyperlane Docs](https://docs.hyperlane.xyz/)
- [Cairo Book](https://book.cairo-lang.org/)
- [Starknetkit](https://github.com/starknet-io/starknetkit)
