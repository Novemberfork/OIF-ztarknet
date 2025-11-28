# Starknet OIF Bridge - Vite + React Implementation Plan

> **Last Updated**: January 2025
> **Stack Verified**: Modern 2025 Starknet tooling (starknet.js v8+, @starknet-react/core v4+)

## Overview
This document outlines the implementation plan for building a **Starknet-focused** cross-chain intent bridge UI from scratch using **Vite + React**. The goal is to enable cross-chain intent filling between EVM chains and Starknet using the existing Cairo contracts and Hyperlane infrastructure.

## Project Details
- **Project Name**: `starknet-oif-bridge`
- **Framework**: Vite + React (TypeScript)
- **Primary Chain**: Starknet (Mainnet, Sepolia, zStarknet)
- **Cross-chain Support**: EVM chains via Hyperlane (Optimism, Arbitrum, Base)
- **Routing**: React Router (optional, can start without)
- **Styling**: TailwindCSS (or CSS modules)

## Modern 2025 Stack
- ✅ **starknet.js v8.x** - Latest SDK with RPC 0.8/0.9 support
- ✅ **@starknet-react/core v4.x** - Built-in wallet connectors (no starknetkit needed!)
- ✅ **@starknet-react/chains v3.x** - Pre-configured chain metadata
- ✅ **useInjectedConnectors** - Auto-discovery of installed wallets
- ✅ **Built-in connectors** - `argent()`, `braavos()`, `injected()` functions

## Current State
- **UI**: ✅ Vite + React boilerplate exists in `starknet-oif-bridge/`
- **Contracts**: Cairo contracts exist in `/cairo/` including Hyperlane7683, MockERC20, and Permit2
- **Infrastructure**: Hyperlane solver supports cross-chain messaging to Starknet
- **Reference UI**: oif-ui-starter (Next.js multi-chain UI) - used for UX patterns only

## Implementation Phases

---

## Phase 1: Install Dependencies & Configure

### 1.1 Install Starknet Dependencies
Add required packages:

```bash
cd starknet-oif-bridge
npm install starknet @starknet-react/core @starknet-react/chains
```

**Core libraries (2025 modern stack):**
- `starknet`: Official Starknet.js SDK v8.x+ for contract interactions
- `@starknet-react/core`: v4.x+ React hooks for Starknet wallet and contracts (includes built-in connectors!)
- `@starknet-react/chains`: v3.x+ Chain configurations (mainnet, sepolia)

**What's included:**
- ✅ Wallet connectors (`argent()`, `braavos()`, `injected()`) are now built into @starknet-react/core
- ✅ No need for separate starknetkit package
- ✅ Auto-discovery with `useInjectedConnectors` hook

**Optional dependencies:**
```bash
# If using Tailwind (recommended)
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# For better type support
npm install -D @types/node
```

**Task checklist:**
- [ ] Install Starknet dependencies
- [ ] Verify versions: starknet@^8.0.0, @starknet-react/core@^4.0.0
- [ ] Test dev server still runs: `npm run dev`

### 1.2 Configure TypeScript Path Aliases
**Update `tsconfig.json`** to add path aliases:

```json
{
  "compilerOptions": {
    // ... existing config
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Update `vite.config.ts`:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Task checklist:**
- [ ] Update tsconfig.json
- [ ] Update vite.config.ts
- [ ] Test imports with @/ work

### 1.3 Setup Tailwind (Optional)
If using Tailwind for styling:

**Update `tailwind.config.js`:**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Update `src/index.css`:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Task checklist:**
- [ ] Configure Tailwind
- [ ] Test Tailwind classes work
- [ ] OR skip and use plain CSS

---

## Phase 2: Wallet Integration

### 2.1 Setup Starknet Provider in App
**File:** `src/main.tsx`

Wrap the app with StarknetConfig provider using modern 2025 pattern:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { StarknetConfig, publicProvider, argent, braavos, useInjectedConnectors } from '@starknet-react/core';
import { mainnet, sepolia } from '@starknet-react/chains';

// Custom zStarknet chain config
const zstarknet = {
  id: BigInt('0x1'), // Update with actual zStarknet chain ID
  network: 'zstarknet',
  name: 'zStarknet Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://188.34.188.124:6060'] },
    public: { http: ['http://188.34.188.124:6060'] },
  },
  testnet: true,
};

function Root() {
  // Modern approach: auto-discover injected wallets
  const { connectors } = useInjectedConnectors({
    // Show these as recommended if user has no wallets installed
    recommended: [argent(), braavos()],
    // Only show recommended if no wallets found
    includeRecommended: 'onlyIfNoConnectors',
    // Randomize order
    order: 'random',
  });

  return (
    <StarknetConfig
      chains={[mainnet, sepolia, zstarknet]}
      provider={publicProvider()}
      connectors={connectors}
      autoConnect
    >
      <App />
    </StarknetConfig>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
```

**Modern pattern benefits:**
- ✅ Auto-discovers installed wallets (Argent X, Braavos, etc.)
- ✅ Shows recommended wallets if none installed
- ✅ No manual connector configuration needed
- ✅ Connectors built into @starknet-react/core

**Implementation tasks:**
- [ ] Update `src/main.tsx` with StarknetConfig
- [ ] Use `useInjectedConnectors` hook for auto-discovery
- [ ] Add Starknet chains (mainnet, sepolia, zstarknet)
- [ ] Enable autoConnect for better UX
- [ ] Test wallet provider is accessible in components

### 2.2 Create Wallet Connection Components
**File:** `src/components/wallet/WalletButton.tsx`

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
      <h3>Connect Wallet</h3>
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

**File:** `src/components/wallet/AccountDisplay.tsx`

```typescript
import { useAccount, useBalance, useNetwork } from '@starknet-react/core';

export function AccountDisplay() {
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const { data: balance, isLoading } = useBalance({
    address,
    token: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH token address
    watch: true,
  });

  if (!isConnected) return null;

  return (
    <div className="account-info">
      <div className="chain-badge">{chain?.name || 'Unknown Network'}</div>
      <div className="address" title={address}>
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </div>
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
- [ ] Create `src/components/wallet/` directory
- [ ] Create `WalletButton.tsx`
- [ ] Create `AccountDisplay.tsx`
- [ ] Add basic styling (Tailwind or CSS)
- [ ] Handle connection states (connecting, connected, disconnected)
- [ ] Show network badge with chain name
- [ ] Display ETH balance on Starknet
- [ ] Add error handling for connection failures

### 2.3 Create Network Switcher
**File:** `src/components/wallet/NetworkSwitcher.tsx`

```typescript
import { useNetwork } from '@starknet-react/core';

export function NetworkSwitcher() {
  const { chain } = useNetwork();

  // Note: Network switching in Starknet wallets is typically done
  // in the wallet extension itself, not programmatically

  return (
    <div className="network-display">
      <span className="network-indicator"></span>
      <span>{chain?.name || 'Not Connected'}</span>
    </div>
  );
}
```

**Tasks:**
- [ ] Create network display component
- [ ] Show current network (mainnet/sepolia/zstarknet)
- [ ] Add visual indicator (dot with color)
- [ ] Note: Users switch networks in wallet extension

### 2.4 Update App.tsx with Wallet Components
**File:** `src/App.tsx`

```typescript
import { WalletButton } from './components/wallet/WalletButton';
import { AccountDisplay } from './components/wallet/AccountDisplay';
import { NetworkSwitcher } from './components/wallet/NetworkSwitcher';

function App() {
  return (
    <div className="app">
      <header>
        <h1>Starknet OIF Bridge</h1>
        <div className="header-actions">
          <NetworkSwitcher />
          <WalletButton />
        </div>
      </header>

      <main>
        <AccountDisplay />
        {/* Bridge UI will go here */}
      </main>
    </div>
  );
}

export default App;
```

**Tasks:**
- [ ] Update App.tsx with wallet components
- [ ] Create basic layout (header, main)
- [ ] Test wallet connection flow
- [ ] Verify all wallet hooks work correctly

---

## Phase 3: Chain & Token Configuration

### 3.1 Define Chain Constants
**File:** `src/config/chains.ts`

Create simple chain configuration:

```typescript
export interface ChainConfig {
  id: string;
  name: string;
  chainId: bigint;
  rpcUrl: string;
  explorer: string;
  nativeToken: {
    symbol: string;
    decimals: number;
  };
  isTestnet: boolean;
}

export const chains: Record<string, ChainConfig> = {
  starknetSepolia: {
    id: 'starknet-sepolia',
    name: 'Starknet Sepolia',
    chainId: BigInt('0x534e5f5345504f4c4941'), // SN_SEPOLIA
    rpcUrl: 'https://starknet-sepolia.public.blastapi.io',
    explorer: 'https://sepolia.starkscan.co',
    nativeToken: {
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: true,
  },
  zstarknet: {
    id: 'zstarknet',
    name: 'zStarknet Testnet',
    chainId: BigInt('0x1'), // Update with actual zStarknet chain ID
    rpcUrl: 'http://188.34.188.124:6060',
    explorer: '', // No explorer yet
    nativeToken: {
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: true,
  },
  starknetMainnet: {
    id: 'starknet-mainnet',
    name: 'Starknet',
    chainId: BigInt('0x534e5f4d41494e'), // SN_MAIN
    rpcUrl: 'https://starknet-mainnet.public.blastapi.io',
    explorer: 'https://starkscan.co',
    nativeToken: {
      symbol: 'ETH',
      decimals: 18,
    },
    isTestnet: false,
  },
};

// Helper functions
export function getExplorerUrl(chainId: string, txHash: string): string {
  const chain = chains[chainId];
  if (!chain?.explorer) return '';
  return `${chain.explorer}/tx/${txHash}`;
}

export function getChainById(id: string): ChainConfig | undefined {
  return chains[id];
}
```

**Tasks:**
- [ ] Create `src/config/chains.ts`
- [ ] Define chain configurations
- [ ] Add helper functions for explorer URLs
- [ ] Verify chain IDs match actual networks
- [ ] Test RPC connectivity

### 3.2 Contract Addresses Configuration
**File:** `src/config/contracts.ts`

Store deployed contract addresses:

```typescript
export interface ContractAddresses {
  hyperlane7683: string;
  erc20: string;
  permit2: string;
  mailbox?: string;
}

export const contracts: Record<string, ContractAddresses> = {
  'starknet-sepolia': {
    hyperlane7683: '0x...', // TODO: Get from deployment
    erc20: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH
    permit2: '0x...', // TODO: Get from deployment
  },
  'zstarknet': {
    hyperlane7683: '0x...', // TODO: Get from cairo/deployments
    erc20: '0x...', // MockERC20 address
    permit2: '0x...', // Permit2 address
  },
};

export function getContractAddresses(chainId: string): ContractAddresses | undefined {
  return contracts[chainId];
}
```

**Tasks:**
- [ ] Create `src/config/contracts.ts`
- [ ] Get deployed addresses from `/cairo/` deployments
- [ ] Add addresses for each network
- [ ] Document where addresses come from

---

## Phase 4: Contract ABIs & Types

### 4.1 Extract Cairo Contract ABIs
**Directory:** `src/abis/`

Extract ABIs from compiled Cairo contracts:

```bash
# From project root
mkdir -p starknet-oif-bridge/src/abis

# Copy ABIs from cairo build output
cp cairo/target/dev/hyperlane7683_Hyperlane7683.contract_class.json \
   starknet-oif-bridge/src/abis/Hyperlane7683.json

cp cairo/target/dev/erc20_MockERC20.contract_class.json \
   starknet-oif-bridge/src/abis/ERC20.json

cp cairo/target/dev/permit2_Permit2.contract_class.json \
   starknet-oif-bridge/src/abis/Permit2.json
```

**Or create simplified ABI files manually:**

**File:** `src/abis/ERC20.json`
```json
{
  "abi": [
    {
      "name": "balanceOf",
      "type": "function",
      "inputs": [{"name": "account", "type": "felt"}],
      "outputs": [{"name": "balance", "type": "Uint256"}],
      "stateMutability": "view"
    },
    {
      "name": "approve",
      "type": "function",
      "inputs": [
        {"name": "spender", "type": "felt"},
        {"name": "amount", "type": "Uint256"}
      ],
      "outputs": [{"name": "success", "type": "felt"}]
    },
    {
      "name": "transfer",
      "type": "function",
      "inputs": [
        {"name": "recipient", "type": "felt"},
        {"name": "amount", "type": "Uint256"}
      ],
      "outputs": [{"name": "success", "type": "felt"}]
    }
  ]
}
```

**Tasks:**
- [ ] Create `src/abis/` directory
- [ ] Extract ABI from Cairo build output OR create manually
- [ ] Add ABIs for: Hyperlane7683, ERC20, Permit2
- [ ] Verify ABI structure matches starknet.js requirements

### 4.2 Create TypeScript Types
**File:** `src/types/contracts.ts`

Define TypeScript interfaces for contract interactions:

```typescript
import { Uint256 } from 'starknet';

export interface IntentData {
  destinationChain: string;
  token: string;
  amount: Uint256;
  recipient: string;
  deadline: number;
}

export interface Intent {
  id: string;
  creator: string;
  data: IntentData;
  status: 'pending' | 'fulfilled' | 'expired';
  createdAt: number;
}

export interface TransactionResult {
  hash: string;
  status: 'pending' | 'success' | 'failed';
}
```

**Tasks:**
- [ ] Create `src/types/contracts.ts`
- [ ] Define intent data structures
- [ ] Add transaction types
- [ ] Export types for use across app

---

## Phase 5: Contract Integration Hooks

### 5.1 Create ERC20 Token Hook
**File:** `src/hooks/useERC20.ts`

```typescript
import { Contract } from 'starknet';
import { useAccount, useContractRead, useContractWrite } from '@starknet-react/core';
import ERC20Abi from '@/abis/ERC20.json';
import { uint256 } from 'starknet';

export function useERC20(tokenAddress: string) {
  const { address: accountAddress } = useAccount();

  // Read balance
  const { data: balance, refetch: refetchBalance } = useContractRead({
    address: tokenAddress,
    abi: ERC20Abi.abi,
    functionName: 'balanceOf',
    args: [accountAddress],
    watch: true,
  });

  // Approve spending
  const { writeAsync: approve } = useContractWrite({
    calls: [{
      contractAddress: tokenAddress,
      entrypoint: 'approve',
      calldata: [], // Will be filled by caller
    }],
  });

  const approveTokens = async (spender: string, amount: bigint) => {
    const amountUint256 = uint256.bnToUint256(amount);
    return approve({
      calls: [{
        contractAddress: tokenAddress,
        entrypoint: 'approve',
        calldata: [spender, amountUint256.low, amountUint256.high],
      }],
    });
  };

  return {
    balance,
    refetchBalance,
    approveTokens,
  };
}
```

**Tasks:**
- [ ] Create `src/hooks/useERC20.ts`
- [ ] Implement balance reading
- [ ] Implement approve function
- [ ] Handle Uint256 conversions
- [ ] Add error handling

### 5.2 Create Hyperlane7683 Contract Hook
**File:** `src/hooks/useHyperlane7683.ts`

```typescript
import { useAccount, useContractWrite, useContractRead } from '@starknet-react/core';
import { getContractAddresses } from '@/config/contracts';
import Hyperlane7683Abi from '@/abis/Hyperlane7683.json';
import { IntentData } from '@/types/contracts';
import { uint256 } from 'starknet';

export function useHyperlane7683(chainId: string) {
  const { address } = useAccount();
  const contractAddresses = getContractAddresses(chainId);

  if (!contractAddresses?.hyperlane7683) {
    throw new Error(`No Hyperlane7683 contract for chain ${chainId}`);
  }

  const contractAddress = contractAddresses.hyperlane7683;

  // Submit intent
  const { writeAsync: write } = useContractWrite({
    calls: [],
  });

  const submitIntent = async (intentData: IntentData) => {
    const amountUint256 = uint256.bnToUint256(intentData.amount);

    return write({
      calls: [{
        contractAddress,
        entrypoint: 'submit_intent',
        calldata: [
          intentData.destinationChain,
          intentData.token,
          amountUint256.low,
          amountUint256.high,
          intentData.recipient,
          intentData.deadline,
        ],
      }],
    });
  };

  // Read intent by ID
  const getIntent = (intentId: string) => {
    return useContractRead({
      address: contractAddress,
      abi: Hyperlane7683Abi.abi,
      functionName: 'get_intent',
      args: [intentId],
    });
  };

  return {
    submitIntent,
    getIntent,
    contractAddress,
  };
}
```

**Tasks:**
- [ ] Create `src/hooks/useHyperlane7683.ts`
- [ ] Implement submitIntent function
- [ ] Implement getIntent function
- [ ] Handle calldata encoding for Cairo
- [ ] Add transaction status tracking
- [ ] Test on Sepolia testnet

### 5.3 Create Transaction Status Hook
**File:** `src/hooks/useTransactionStatus.ts`

```typescript
import { useState, useEffect } from 'react';
import { useProvider } from '@starknet-react/core';
import { GetTransactionReceiptResponse } from 'starknet';

export function useTransactionStatus(txHash: string | null) {
  const { provider } = useProvider();
  const [status, setStatus] = useState<'pending' | 'success' | 'failed' | null>(null);
  const [receipt, setReceipt] = useState<GetTransactionReceiptResponse | null>(null);

  useEffect(() => {
    if (!txHash || !provider) return;

    let cancelled = false;
    setStatus('pending');

    const pollTx = async () => {
      try {
        while (!cancelled) {
          const txReceipt = await provider.getTransactionReceipt(txHash);

          if (txReceipt.execution_status === 'SUCCEEDED') {
            setStatus('success');
            setReceipt(txReceipt);
            break;
          } else if (txReceipt.execution_status === 'REVERTED') {
            setStatus('failed');
            setReceipt(txReceipt);
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2s
        }
      } catch (error) {
        console.error('Error polling transaction:', error);
        setStatus('failed');
      }
    };

    pollTx();

    return () => {
      cancelled = true;
    };
  }, [txHash, provider]);

  return { status, receipt };
}
```

**Tasks:**
- [ ] Create transaction polling hook
- [ ] Handle different tx statuses
- [ ] Add timeout/retry logic
- [ ] Return receipt data

---

## Phase 6: Bridge UI Components

### 6.1 Create Intent Submission Form
**File:** `src/components/bridge/IntentForm.tsx`

```typescript
import { useState } from 'react';
import { useAccount, useNetwork } from '@starknet-react/core';
import { useHyperlane7683 } from '@/hooks/useHyperlane7683';
import { useERC20 } from '@/hooks/useERC20';
import { getContractAddresses } from '@/config/contracts';

export function IntentForm() {
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [destinationChain, setDestinationChain] = useState('optimism-sepolia');

  const chainId = chain?.id || 'starknet-sepolia';
  const contracts = getContractAddresses(chainId);
  const { submitIntent } = useHyperlane7683(chainId);
  const { balance, approveTokens } = useERC20(contracts?.erc20 || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected || !contracts) {
      alert('Please connect wallet');
      return;
    }

    try {
      // 1. Approve tokens
      const amountWei = BigInt(parseFloat(amount) * 1e18);
      await approveTokens(contracts.hyperlane7683, amountWei);

      // 2. Submit intent
      const intentData = {
        destinationChain,
        token: contracts.erc20,
        amount: amountWei,
        recipient,
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      };

      const result = await submitIntent(intentData);
      alert(`Intent submitted! TX: ${result.transaction_hash}`);
    } catch (error) {
      console.error('Error submitting intent:', error);
      alert('Failed to submit intent');
    }
  };

  if (!isConnected) {
    return <div>Please connect your wallet</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="intent-form">
      <h2>Bridge Tokens</h2>

      <div className="form-field">
        <label>Destination Chain</label>
        <select value={destinationChain} onChange={(e) => setDestinationChain(e.target.value)}>
          <option value="optimism-sepolia">Optimism Sepolia</option>
          <option value="base-sepolia">Base Sepolia</option>
          <option value="arbitrum-sepolia">Arbitrum Sepolia</option>
        </select>
      </div>

      <div className="form-field">
        <label>Amount (ETH)</label>
        <input
          type="number"
          step="0.001"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.1"
          required
        />
        {balance && <span className="balance-hint">Balance: {balance.toString()}</span>}
      </div>

      <div className="form-field">
        <label>Recipient Address (on destination chain)</label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x..."
          required
        />
      </div>

      <button type="submit" className="submit-btn">
        Submit Intent
      </button>
    </form>
  );
}
```

**Tasks:**
- [ ] Create `src/components/bridge/IntentForm.tsx`
- [ ] Add form validation
- [ ] Handle approve + submit flow
- [ ] Show loading states
- [ ] Display transaction hash after submit

### 6.2 Create Transaction Status Component
**File:** `src/components/bridge/TransactionStatus.tsx`

```typescript
import { useTransactionStatus } from '@/hooks/useTransactionStatus';
import { getExplorerUrl } from '@/config/chains';
import { useNetwork } from '@starknet-react/core';

interface Props {
  txHash: string | null;
  onClose: () => void;
}

export function TransactionStatus({ txHash, onClose }: Props) {
  const { chain } = useNetwork();
  const { status, receipt } = useTransactionStatus(txHash);

  if (!txHash) return null;

  const explorerUrl = getExplorerUrl(chain?.id || '', txHash);

  return (
    <div className="transaction-status">
      <h3>Transaction Status</h3>

      <div className="status-indicator">
        {status === 'pending' && <span className="pending">⏳ Pending...</span>}
        {status === 'success' && <span className="success">✅ Success!</span>}
        {status === 'failed' && <span className="failed">❌ Failed</span>}
      </div>

      <div className="tx-hash">
        <code>{txHash.slice(0, 10)}...{txHash.slice(-8)}</code>
      </div>

      {explorerUrl && (
        <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
          View on Explorer →
        </a>
      )}

      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

**Tasks:**
- [ ] Create transaction status display
- [ ] Show loading/success/error states
- [ ] Link to block explorer
- [ ] Add close button

### 6.3 Update App.tsx with Bridge UI
**File:** `src/App.tsx`

```typescript
import { useState } from 'react';
import { WalletButton } from './components/wallet/WalletButton';
import { AccountDisplay } from './components/wallet/AccountDisplay';
import { NetworkSwitcher } from './components/wallet/NetworkSwitcher';
import { IntentForm } from './components/bridge/IntentForm';
import { TransactionStatus } from './components/bridge/TransactionStatus';
import './App.css';

function App() {
  const [currentTxHash, setCurrentTxHash] = useState<string | null>(null);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Starknet OIF Bridge</h1>
        <div className="header-actions">
          <NetworkSwitcher />
          <WalletButton />
        </div>
      </header>

      <main className="app-main">
        <AccountDisplay />

        <div className="bridge-container">
          <IntentForm />
        </div>

        {currentTxHash && (
          <TransactionStatus
            txHash={currentTxHash}
            onClose={() => setCurrentTxHash(null)}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>Cross-chain intents powered by Hyperlane & Starknet</p>
      </footer>
    </div>
  );
}

export default App;
```

**Tasks:**
- [ ] Update App.tsx with bridge components
- [ ] Add basic layout and styling
- [ ] Test complete flow: connect → approve → submit → track

---

## Phase 7: Styling & Polish

### 7.1 Create Basic CSS Styles
**File:** `src/App.css`

```css
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.app-header h1 {
  color: white;
  font-size: 1.5rem;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.app-main {
  flex: 1;
  padding: 2rem;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

.bridge-container {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  margin-top: 2rem;
}

.intent-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-field label {
  font-weight: 600;
  color: #333;
}

.form-field input,
.form-field select {
  padding: 0.75rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-field input:focus,
.form-field select:focus {
  outline: none;
  border-color: #667eea;
}

.submit-btn {
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.submit-btn:hover {
  transform: translateY(-2px);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.transaction-status {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  min-width: 400px;
}

.wallet-connected {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem 1rem;
  background: white;
  border-radius: 8px;
}

.wallet-select {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.wallet-select button {
  padding: 0.75rem 1rem;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.wallet-select button:hover:not(:disabled) {
  border-color: #667eea;
  background: #f7fafc;
}

.account-info {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  gap: 1rem;
  align-items: center;
}

.app-footer {
  padding: 1.5rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
}
```

**Tasks:**
- [ ] Create App.css with basic styling
- [ ] Add responsive design
- [ ] Style wallet components
- [ ] Style bridge form
- [ ] Add loading animations

### 7.2 Add Environment Variables
**File:** `.env.example`

```bash
# Starknet RPC URLs
VITE_STARKNET_MAINNET_RPC=https://starknet-mainnet.public.blastapi.io
VITE_STARKNET_SEPOLIA_RPC=https://starknet-sepolia.public.blastapi.io
VITE_ZSTARKNET_RPC=http://188.34.188.124:6060

# Contract Addresses (Sepolia)
VITE_SEPOLIA_HYPERLANE7683=0x...
VITE_SEPOLIA_ERC20=0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7

# Contract Addresses (zStarknet)
VITE_ZSTARKNET_HYPERLANE7683=0x...
VITE_ZSTARKNET_ERC20=0x...
```

**File:** `.env` (gitignored)
```bash
# Copy from .env.example and fill in actual values
```

**Update `src/config/contracts.ts`:**
```typescript
export const contracts: Record<string, ContractAddresses> = {
  'starknet-sepolia': {
    hyperlane7683: import.meta.env.VITE_SEPOLIA_HYPERLANE7683,
    erc20: import.meta.env.VITE_SEPOLIA_ERC20,
    permit2: import.meta.env.VITE_SEPOLIA_PERMIT2,
  },
  'zstarknet': {
    hyperlane7683: import.meta.env.VITE_ZSTARKNET_HYPERLANE7683,
    erc20: import.meta.env.VITE_ZSTARKNET_ERC20,
    permit2: import.meta.env.VITE_ZSTARKNET_PERMIT2,
  },
};
```

**Tasks:**
- [ ] Create .env.example
- [ ] Add environment variables for contract addresses
- [ ] Update config files to use env vars
- [ ] Document required environment variables

---

## Phase 8: Testing & Validation

### 8.1 Manual Testing Checklist

**Wallet Connection:**
- [ ] Test Argent X wallet connection
- [ ] Test Braavos wallet connection
- [ ] Verify wallet disconnection works
- [ ] Test reconnection flow
- [ ] Verify balance displays correctly

**Network Switching:**
- [ ] Switch from Sepolia to zStarknet in wallet
- [ ] Verify UI updates with correct network name
- [ ] Verify contract addresses change per network

**Intent Submission Flow:**
- [ ] Connect wallet with test ETH on Sepolia
- [ ] Enter valid recipient address
- [ ] Enter amount (e.g., 0.01 ETH)
- [ ] Submit approval transaction
- [ ] Wait for approval confirmation
- [ ] Submit intent transaction
- [ ] Verify transaction hash is displayed
- [ ] Check transaction status on Starkscan

**Error Handling:**
- [ ] Try to submit without connecting wallet
- [ ] Try to submit with insufficient balance
- [ ] Try to submit with invalid recipient address
- [ ] Test transaction rejection in wallet
- [ ] Test network error handling

**End-to-End Test:**
- [ ] Submit intent from Starknet Sepolia to Optimism Sepolia
- [ ] Record intent ID and transaction hash
- [ ] Monitor solver logs for intent pickup
- [ ] Verify intent fulfillment on destination chain
- [ ] Confirm funds received on Optimism

**Browser Compatibility:**
- [ ] Test on Chrome
- [ ] Test on Firefox
- [ ] Test on Brave
- [ ] Test mobile wallet connect (if applicable)

### 8.2 Debugging & Troubleshooting

**Common Issues:**

1. **Wallet not connecting:**
   - Check if wallet extension is installed
   - Verify wallet is unlocked
   - Check browser console for errors
   - Try refreshing the page

2. **Transaction failing:**
   - Check balance is sufficient (including fees)
   - Verify contract addresses are correct
   - Check network is correct in wallet
   - Inspect transaction on Starkscan for revert reason

3. **ABIs not loading:**
   - Verify ABI files exist in `src/abis/`
   - Check JSON format is valid
   - Ensure import paths are correct

4. **Contract not found:**
   - Verify environment variables are set
   - Check contract addresses are deployed on current network
   - Confirm RPC URL is correct

### 8.3 Pre-Launch Checklist
- [ ] All environment variables documented
- [ ] Contract addresses verified and deployed
- [ ] ABIs match deployed contracts
- [ ] Wallet connection tested with multiple wallets
- [ ] At least 3 successful test transactions on Sepolia
- [ ] Error messages are user-friendly
- [ ] Loading states work correctly
- [ ] Transaction status tracking works
- [ ] Explorer links open correctly
- [ ] UI is responsive on mobile

---

## Phase 9: Documentation & Deployment

### 9.1 Create README
**File:** `README.md`

```markdown
# Starknet OIF Bridge

A cross-chain intent bridge connecting Starknet with EVM chains via Hyperlane.

## Features

- Connect Starknet wallets (Argent X, Braavos)
- Submit cross-chain intents from Starknet to EVM chains
- Real-time transaction tracking
- Support for Starknet Mainnet, Sepolia, and zStarknet testnet

## Prerequisites

- Node.js 18+ and npm
- Starknet wallet (Argent X or Braavos browser extension)
- Test ETH on Starknet Sepolia (get from [Starknet Faucet](https://faucet.goerli.starknet.io/))

## Quick Start

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in contract addresses
4. Start dev server: `npm run dev`
5. Open http://localhost:5173
6. Connect your Starknet wallet

## Environment Variables

See `.env.example` for required configuration.

## Contract Addresses

Contract addresses are stored in `src/config/contracts.ts`.

For deployed addresses, see the main project's Cairo deployment docs.

## Architecture

- **Framework**: Vite + React + TypeScript
- **Wallet**: @starknet-react/core + starknetkit
- **Contracts**: Cairo contracts in `/cairo/` directory
- **Cross-chain**: Hyperlane protocol

## Development

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

## Testing

See Phase 8 in ZTARKNET_UI_IMPLEMENTATION_PLAN.md for testing procedures.

## License

MIT
```

**Tasks:**
- [ ] Create comprehensive README
- [ ] Add setup instructions
- [ ] Document environment variables
- [ ] Link to main project Cairo contracts

### 9.2 Deployment Setup

**File:** `vercel.json` (if deploying to Vercel)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

**Build for production:**
```bash
npm run build
```

**Preview production build:**
```bash
npm run preview
```

**Deploy options:**
- Vercel: `vercel deploy`
- Netlify: `netlify deploy --prod`
- GitHub Pages: Configure in repo settings
- IPFS: `npm run build && ipfs add -r dist/`

**Tasks:**
- [ ] Test production build locally
- [ ] Set up deployment platform
- [ ] Configure environment variables on platform
- [ ] Deploy to testnet domain first
- [ ] Verify deployed app works correctly

### 9.3 Project Structure Documentation

**Final project structure:**

```
starknet-oif-bridge/
├── src/
│   ├── components/
│   │   ├── wallet/
│   │   │   ├── WalletButton.tsx
│   │   │   ├── AccountDisplay.tsx
│   │   │   └── NetworkSwitcher.tsx
│   │   └── bridge/
│   │       ├── IntentForm.tsx
│   │       └── TransactionStatus.tsx
│   ├── hooks/
│   │   ├── useERC20.ts
│   │   ├── useHyperlane7683.ts
│   │   └── useTransactionStatus.ts
│   ├── config/
│   │   ├── chains.ts
│   │   └── contracts.ts
│   ├── types/
│   │   └── contracts.ts
│   ├── abis/
│   │   ├── ERC20.json
│   │   ├── Hyperlane7683.json
│   │   └── Permit2.json
│   ├── App.tsx
│   ├── App.css
│   ├── main.tsx
│   └── index.css
├── public/
├── .env.example
├── .env
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Phase 10: Future Enhancements (Optional)

### 10.1 Advanced Features
- [ ] Transaction history view (localStorage or indexer)
- [ ] Intent status tracking (query Hyperlane explorer API)
- [ ] Multi-token support (beyond ETH)
- [ ] Gas estimation before submission
- [ ] Address book for frequent recipients
- [ ] Dark mode toggle

### 10.2 Performance Optimizations
- [ ] Implement React.memo for expensive components
- [ ] Add loading skeletons instead of spinners
- [ ] Optimize bundle size (code splitting)
- [ ] Add service worker for offline support
- [ ] Cache contract reads

### 10.3 Better UX
- [ ] Toast notifications (react-hot-toast)
- [ ] Form validation with better error messages
- [ ] Estimated time to finality display
- [ ] Recent transactions list
- [ ] Intent fulfillment notifications
- [ ] Mobile-optimized layout

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
| Phase 1: Dependencies & Config | 0.5 days | Boilerplate exists ✅ |
| Phase 2: Wallet Integration | 1-2 days | Phase 1 |
| Phase 3: Configuration | 0.5 days | None |
| Phase 4: ABIs & Types | 1 day | Cairo contracts |
| Phase 5: Contract Hooks | 2-3 days | Phase 2, 4 |
| Phase 6: Bridge UI | 2-3 days | Phase 2, 5 |
| Phase 7: Styling & Polish | 1-2 days | Phase 6 |
| Phase 8: Testing | 2-3 days | Phase 6, 7 |
| Phase 9: Documentation & Deploy | 1 day | Phase 8 |
| Phase 10: Enhancements (Optional) | 2-3 days | Phase 9 |
| **Total (MVP)** | **10-15 days** | |
| **Total (with enhancements)** | **12-18 days** | |

---

## Success Criteria

**MVP (Minimum Viable Product) is complete when:**

- [ ] Users can connect Starknet wallets (Argent X or Braavos)
- [ ] Users can view their ETH balance on Starknet
- [ ] Users can submit cross-chain intents from Starknet to an EVM chain
- [ ] Transactions show loading → success/failure states
- [ ] Transaction hashes link to Starkscan explorer
- [ ] UI works on Starknet Sepolia testnet
- [ ] At least 3 successful test transactions completed
- [ ] README and setup documentation is complete
- [ ] App is deployed to a public URL

**Optional enhancements complete when:**
- [ ] Transaction history is viewable
- [ ] Multiple tokens supported (not just ETH)
- [ ] Mobile-responsive design polished
- [ ] Toast notifications implemented

---

## Open Questions & Prerequisites

**Questions to answer before starting:**

1. **Contract Addresses**: Where are the deployed Hyperlane7683 contract addresses for Sepolia and zStarknet?
   - Location: Check `/cairo/` deployment scripts or docs
   - Document in `src/config/contracts.ts`

2. **ABIs**: Are the compiled Cairo contracts available?
   - Location: `/cairo/target/dev/*.json`
   - Need: Hyperlane7683.json, ERC20.json, Permit2.json

3. **zStarknet Chain ID**: What is the actual chain ID for zStarknet testnet?
   - Update in `src/main.tsx` zstarknet config

4. **Solver Status**: Is the Hyperlane solver running and monitoring Starknet?
   - Check `/solver/` implementation
   - Verify it can fulfill intents from Starknet

5. **RPC Stability**: Is `http://188.34.188.124:6060` stable for zStarknet?
   - Test connectivity
   - Have backup RPC if needed

**Prerequisites:**
- Cairo contracts deployed on target networks
- ABIs exported and available
- Contract addresses documented
- Test ETH available on Sepolia
- Solver running and monitoring chains

---

## Next Steps

**Immediate (Day 1):**
1. ✅ Vite boilerplate exists - **ready to start!**
2. Gather all contract addresses from Cairo deployments
3. Extract ABIs from `/cairo/target/dev/`
4. Verify zStarknet RPC is accessible: `curl http://188.34.188.124:6060`
5. Install Starknet dependencies: `npm install starknet @starknet-react/core @starknet-react/chains starknetkit`
6. Configure path aliases in tsconfig.json and vite.config.ts

**Week 1 (Days 1-7):**
1. Complete Phases 1-4 (deps, wallet, config, ABIs)
2. Start Phase 5 (contract hooks)
3. Test wallet connection and balance reading
4. First successful wallet connect on Sepolia

**Week 2 (Days 8-14):**
1. Complete Phase 5-6 (hooks, bridge UI)
2. Complete Phase 7 (styling)
3. Begin testing on Sepolia
4. Submit first test intent transaction
5. Verify transaction appears on Starkscan

**Week 2-3 (Days 15+):**
1. Complete Phase 8 (thorough testing)
2. Complete Phase 9 (docs and deploy)
3. Deploy to Vercel/Netlify
4. Optional: Start Phase 10 enhancements
5. Launch MVP 🚀

---

## References

### Starknet Resources (2025)
- [Starknet Documentation](https://docs.starknet.io) - Official Starknet docs
- [Starknet.js v8+ Docs](https://starknetjs.com/) - Latest JavaScript SDK (v8.x with RPC 0.8/0.9)
- [Starknet React v4 Docs](https://www.starknet-react.com/) - Official React hooks with built-in connectors
- [Starknet React Wallets](https://www.starknet-react.com/docs/wallets) - Modern wallet integration guide
- [useInjectedConnectors Hook](https://www.starknet-react.com/docs/hooks/use-injected-connectors) - Auto-discovery API
- [Cairo Book](https://book.cairo-lang.org/) - Learn Cairo programming
- [Starkscan](https://starkscan.co/) - Starknet block explorer
- [Starknetkit](https://www.starknetkit.com/) - Alternative wallet SDK (optional, not needed with starknet-react v4+)

### Frontend Tools
- [Vite Documentation](https://vitejs.dev/) - Build tool
- [React Documentation](https://react.dev/) - UI library
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - Type safety

### Hyperlane & Cross-chain
- [Hyperlane Docs](https://docs.hyperlane.xyz/) - Cross-chain messaging protocol
- [Open Intent Framework](https://github.com/base-org/open-intents) - Intent-based architecture

### Wallets
- [Argent X](https://www.argent.xyz/argent-x/) - Starknet wallet browser extension
- [Braavos](https://braavos.app/) - Starknet wallet

### Deployment
- [Vercel](https://vercel.com/docs) - Deployment platform
- [Netlify](https://docs.netlify.com/) - Alternative deployment
- [GitHub Pages](https://pages.github.com/) - Free static hosting

---

## Summary

This implementation plan provides a **streamlined path** to building a Starknet-focused OIF bridge UI using modern, simple tools:

- ✅ **Vite + React boilerplate exists** - ready to build!
- **@starknet-react** for clean wallet and contract integration
- **Pure Starknet focus** - no multi-chain complexity
- **10-15 day timeline** for MVP (vs. 18-26 days for multi-chain approach)
- **Simple architecture** - easy to understand and maintain

The resulting UI will be:
- ⚡ Lightweight and fast (Vite build optimization)
- 🔧 Easy to maintain and extend
- 🎯 Focused on core use case (Starknet ↔ EVM intents)
- 🚀 Simple to deploy and test
- 📱 Mobile-friendly design

**Ready to start? Begin with Phase 1: Install Dependencies!**

```bash
cd starknet-oif-bridge
npm install starknet @starknet-react/core @starknet-react/chains
```

**Note**: This plan uses the **verified 2025 modern stack** - researched and updated January 2025 with latest Starknet tooling.
