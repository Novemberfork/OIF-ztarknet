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
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
} as const

// Dog coin addresses from solver .env
export const DOG_COIN_ADDRESSES = {
  ethereumSepolia: '0x76878654a2D96dDdF8cF0CFe8FA608aB4CE0D499' as Address,
  optimismSepolia: '0xe2f9C9ECAB8ae246455be4810Cac8fC7C5009150' as Address,
  arbitrumSepolia: '0x1083B934AbB0be83AaE6579c6D5FD974D94e8EA5' as Address,
  baseSepolia: '0xB844EEd1581f3fB810FFb6Dd6C5E30C049cF23F4' as Address,
  starknetSepolia: '0x312be4cb8416dda9e192d7b4d42520e3365f71414aefad7ccd837595125f503',
  ztarknet: '0x067c9b63ecb6a191e369a461ab05cf9a4d08093129e5ac8eedb71d4908e4cc5b',
} as const

// Contract addresses per chain
export const contracts: Record<string, ContractAddresses> = {
  'starknet-sepolia': {
    hyperlane7683: '0x2369427e2142db4dfac3a61f5ea7f084e3a74f4c444b5c4e6192a12e49a349',
    erc20: DOG_COIN_ADDRESSES.starknetSepolia,
    permit2: '0x02286537be3743c9cce6fc9a442cb025c8cae688a671462b732a24d4ffa54889',
  },
  'ztarknet': {
    hyperlane7683: '0x06508892543f6dd254cab6f166e16b4e146743cfaedde9afaa2931c18a335f22',
    erc20: DOG_COIN_ADDRESSES.ztarknet,
    permit2: '0x06e1f45db45be161f29c25ffc35e23492fc30773df248b6c85d206a82eb119f6',
  },
  'ethereum-sepolia': {
    hyperlane7683: EVM_CONTRACTS.hyperlane7683,
    erc20: DOG_COIN_ADDRESSES.ethereumSepolia,
    permit2: EVM_CONTRACTS.permit2,
  },
  'optimism-sepolia': {
    hyperlane7683: EVM_CONTRACTS.hyperlane7683,
    erc20: DOG_COIN_ADDRESSES.optimismSepolia,
    permit2: EVM_CONTRACTS.permit2,
  },
  'arbitrum-sepolia': {
    hyperlane7683: EVM_CONTRACTS.hyperlane7683,
    erc20: DOG_COIN_ADDRESSES.arbitrumSepolia,
    permit2: EVM_CONTRACTS.permit2,
  },
  'base-sepolia': {
    hyperlane7683: EVM_CONTRACTS.hyperlane7683,
    erc20: DOG_COIN_ADDRESSES.baseSepolia,
    permit2: EVM_CONTRACTS.permit2,
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
