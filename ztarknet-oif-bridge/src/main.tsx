import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { mainnet, sepolia, arbitrum, arbitrumSepolia, optimismSepolia, baseSepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StarknetConfig, publicProvider, argent, braavos } from '@starknet-react/core'
import { sepolia as starknetSepolia, mainnet as starknetMainnet } from '@starknet-react/chains'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={evmConfig}>
      <QueryClientProvider client={queryClient}>
        <StarknetConfig
          chains={[starknetSepolia, starknetMainnet]}
          provider={publicProvider()}
          connectors={starknetConnectors}
        >
          <App />
        </StarknetConfig>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
