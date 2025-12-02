import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { mainnet, sepolia, arbitrum, arbitrumSepolia, optimismSepolia, baseSepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StarknetConfig, publicProvider, argent, braavos } from '@starknet-react/core'
import { sepolia as starknetSepolia, mainnet as starknetMainnet, type Chain } from '@starknet-react/chains'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient()

// EVM config - all supported testnets
const evmConfig = createConfig({
  chains: [mainnet, sepolia, arbitrum, arbitrumSepolia, optimismSepolia, baseSepolia],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [arbitrum.id]: http(),
    [arbitrumSepolia.id]: http(),
    [optimismSepolia.id]: http(),
    [baseSepolia.id]: http(),
  },
})

// Starknet config
const starknetConnectors = [argent(), braavos()]

const ztarknet: Chain = {
  //  id: 393402133025997798000961n,
  id: 0x999999n,
  network: "ztarknet",
  name: "Ztarknet Testnet",
  nativeCurrency: {
    address: "0x01ad102b4c4b3e40a51b6fb8a446275d600555bd63a95cdceed3e5cef8a6bc1d",
    name: "Ztarknet Fee Token",
    symbol: "Ztf",
    decimals: 18,
  },
  testnet: true,
  rpcUrls: {
    blast: {
      http: ["https://ztarknet-madara.d.karnot.xyz"],
    },
    infura: {
      http: ["https://ztarknet-madara.d.karnot.xyz"],
    },
    cartridge: {
      http: ["https://ztarknet-madara.d.karnot.xyz"],
    },
    default: {
      http: ["https://ztarknet-madara.d.karnot.xyz"],
    },
    public: {
      http: ["https://ztarknet-madara.d.karnot.xyz"],
    },
  },
  paymasterRpcUrls: {
    avnu: {
      http: ["https://sepolia.paymaster.avnu.fi/"],
    },
  },
  explorers: {
    voyager: ["https://explorer-zstarknet.d.karnot.xyz/"],
  },
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={evmConfig}>
      <QueryClientProvider client={queryClient}>
        <StarknetConfig
          chains={[
            starknetSepolia
          ]}
          provider={publicProvider()}
          connectors={starknetConnectors}
        >
          <App />
        </StarknetConfig>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
