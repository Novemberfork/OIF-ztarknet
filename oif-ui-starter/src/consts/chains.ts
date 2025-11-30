import { ChainMap, ChainMetadata, ExplorerFamily } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

// A map of chain names to ChainMetadata
// Chains can be defined here, in chains.json, or in chains.yaml
// Chains already in the SDK need not be included here unless you want to override some fields
// Schema here: https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/main/typescript/sdk/src/metadata/chainMetadataTypes.ts
export const chains: ChainMap<ChainMetadata & { mailbox?: Address }> = {
  ztarknet: {
    protocol: ProtocolType.Ethereum,
    chainId: 10066329,
    domainId: 10066329,
    name: 'ztarknet',
    displayName: 'Ztarknet Testnet',
    nativeToken: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [{ http: 'https://ztarknet-madara.d.karnot.xyz' }],
    blockExplorers: [
      {
        name: 'Ztarknet Explorer',
        url: 'https://explorer-zstarknet.d.karnot.xyz',
        apiUrl: 'https://explorer-zstarknet.d.karnot.xyz/api',
        family: ExplorerFamily.Blockscout,
      },
    ],
    blocks: {
      confirmations: 1,
      reorgPeriod: 1,
      estimateBlockTime: 6,
    },
    logoURI: '/logos/ztarknet.svg',
  },
};
