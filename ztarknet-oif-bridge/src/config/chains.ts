export interface ChainConfig {
  id: string
  name: string
  chainId: bigint
  rpcUrl: string
  explorer: string
  nativeToken: {
    symbol: string
    decimals: number
  }
  isTestnet: boolean
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
    chainId: BigInt('0x1'), // TODO: Update with actual zStarknet chain ID
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
}

// Helper functions
export function getExplorerUrl(chainId: string, txHash: string): string {
  const chain = chains[chainId]
  if (!chain?.explorer) return ''
  return `${chain.explorer}/tx/${txHash}`
}

export function getChainById(id: string): ChainConfig | undefined {
  return chains[id]
}
