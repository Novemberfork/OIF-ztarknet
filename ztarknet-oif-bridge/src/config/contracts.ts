export interface ContractAddresses {
  hyperlane7683: string
  erc20: string
  permit2: string
  mailbox?: string
}

export const contracts: Record<string, ContractAddresses> = {
  'starknet-sepolia': {
    hyperlane7683: '0x...', // TODO: Get from cairo deployment
    erc20: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH token address
    permit2: '0x...', // TODO: Get from cairo deployment
  },
  'zstarknet': {
    hyperlane7683: '0x...', // TODO: Get from cairo deployment
    erc20: '0x...', // MockERC20 address - update from deployment
    permit2: '0x...', // Permit2 address - update from deployment
  },
}

export function getContractAddresses(chainId: string): ContractAddresses | undefined {
  return contracts[chainId]
}
