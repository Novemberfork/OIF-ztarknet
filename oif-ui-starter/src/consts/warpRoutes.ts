import { type WarpCoreConfig } from '@hyperlane-xyz/sdk';
import { zeroAddress } from 'viem';

const ROUTER = '0xf614c6bF94b022E16BEF7dBecF7614FFD2b201d3';
const ETH_TOKEN = '0x76878654a2D96dDdF8cF0CFe8FA608aB4CE0D499';
const ZTARKNET_TOKEN = '0x067c9b63ecb6a191e369a461ab05cf9a4d08093129e5ac8eedb71d4908e4cc5b';

export const TOP_MAX = {
  'sepolia': {
    [ETH_TOKEN]: 100e18,
    [zeroAddress]: 1e16,
  },
  'ztarknet': {
    [ZTARKNET_TOKEN]: 100e18,
  },
}

// A list of Warp Route token configs
// These configs will be merged with the warp routes in the configured registry
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const warpRouteConfigs: WarpCoreConfig = {
  tokens: [
    {
      addressOrDenom: ETH_TOKEN,
      chainName: 'sepolia',
      collateralAddressOrDenom: ROUTER,
      connections: [
        {
          token: 'ethereum|ztarknet|' + ZTARKNET_TOKEN,
        },
      ],
      decimals: 18,
      logoURI: '/deployments/warp_routes/ETH/logo.svg',
      name: 'OIF Token',
      standard: 'Intent',
      symbol: 'OIF',
      protocol: 'ethereum',
    },
    {
      addressOrDenom: ZTARKNET_TOKEN,
      chainName: 'ztarknet',
      collateralAddressOrDenom: ROUTER,
      connections: [
        {
          token: 'ethereum|sepolia|' + ETH_TOKEN,
        },
      ],
      decimals: 18,
      logoURI: '/deployments/warp_routes/ETH/logo.svg',
      name: 'OIF Token',
      standard: 'Intent',
      symbol: 'OIF',
      protocol: 'ethereum',
    },
  ],
  options: {
    interchainFeeConstants: [
      {
        amount: 3e14,
        origin: 'sepolia',
        destination: 'ztarknet',
        addressOrDenom: ETH_TOKEN,
      },
      {
        amount: 3e14,
        origin: 'ztarknet',
        destination: 'sepolia',
        addressOrDenom: ZTARKNET_TOKEN,
      },
    ],
  },
};
