import type { Address } from 'viem'

export interface ContractAddresses {
  hyperlane7683: string
  erc20: string
  permit2: string
  mailbox?: string
}

// Chain IDs from solver config
export const CHAIN_IDS = {
  ethereumSepolia: 11155111,
  optimismSepolia: 11155420,
  arbitrumSepolia: 421614,
  baseSepolia: 84532,
  starknetSepolia: 23448591,
  ztarknet: 10066329,
} as const

// Hyperlane domain IDs
export const HYPERLANE_DOMAINS = {
  ethereumSepolia: 11155111,
  optimismSepolia: 11155420,
  arbitrumSepolia: 421614,
  baseSepolia: 84532,
  starknetSepolia: 23448591,
  ztarknet: 10066329,
} as const

// EVM contract addresses (shared across Sepolia chains)
export const EVM_CONTRACTS = {
  hyperlane7683: '0xf614c6bF94b022E16BEF7dBecF7614FFD2b201d3' as Address,
  // Common test tokens on Sepolia - update with actual deployed tokens
  testToken: '0x...' as Address, // TODO: Add test ERC20 token address
} as const

// Starknet/Ztarknet contract addresses
export const contracts: Record<string, ContractAddresses> = {
  'starknet-sepolia': {
    hyperlane7683: '0x...', // TODO: Get from STARKNET_HYPERLANE_ADDRESS env
    erc20: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH token address
    permit2: '0x06e1f45db45be161f29c25ffc35e23492fc30773df248b6c85d206a82eb119f6',
  },
  'ztarknet': {
    hyperlane7683: '0x06508892543f6dd254cab6f166e16b4e146743cfaedde9afaa2931c18a335f22',
    erc20: '0x067c9b63ecb6a191e369a461ab05cf9a4d08093129e5ac8eedb71d4908e4cc5b', // MockERC20
    permit2: '0x06e1f45db45be161f29c25ffc35e23492fc30773df248b6c85d206a82eb119f6',
  },
  // EVM chains use the shared EVM_CONTRACTS
  'ethereum-sepolia': {
    hyperlane7683: EVM_CONTRACTS.hyperlane7683,
    erc20: '0x...', // TODO: Add test token address
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3', // Canonical Permit2 on EVM
  },
  'optimism-sepolia': {
    hyperlane7683: EVM_CONTRACTS.hyperlane7683,
    erc20: '0x...',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  'arbitrum-sepolia': {
    hyperlane7683: EVM_CONTRACTS.hyperlane7683,
    erc20: '0x...',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  'base-sepolia': {
    hyperlane7683: EVM_CONTRACTS.hyperlane7683,
    erc20: '0x...',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
}

export function getContractAddresses(chainId: string): ContractAddresses | undefined {
  return contracts[chainId]
}

export function getHyperlane7683Address(chainId: number): Address | undefined {
  // EVM chains
  if ([11155111, 11155420, 421614, 84532].includes(chainId)) {
    return EVM_CONTRACTS.hyperlane7683
  }
  return undefined
}

// Order data type hash for OnchainCrossChainOrder
export const ORDER_DATA_TYPE_HASH = '0x...' as const // TODO: Get from contract

// Open event topic for filtering logs
export const OPEN_EVENT_TOPIC = '0x3448bbc2203c608599ad448eeb1007cea04b788ac631f9f558e8dd01a3c27b3d' as const

// Filled event topic
export const FILLED_EVENT_TOPIC = '0x...' as const // TODO: Calculate from event signature
