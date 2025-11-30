import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { StarknetConfig, publicProvider, argent, braavos } from '@starknet-react/core'
import { mainnet, sepolia } from '@starknet-react/chains'

const zstarknet = {
  id: BigInt('0x1'),
  network: 'zstarknet',
  name: 'zStarknet Testnet',
  nativeCurrency: {
    address: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7' as `0x${string}`,
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['http://188.34.188.124:6060'] },
    public: { http: ['http://188.34.188.124:6060'] },
  },
  paymasterRpcUrls: {
    default: { http: [] },
  },
  testnet: true,
}

const connectors = [argent(), braavos()]

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StarknetConfig
      chains={[mainnet, sepolia, zstarknet]}
      provider={publicProvider()}
      connectors={connectors}
      autoConnect
    >
      <App />
    </StarknetConfig>
  </StrictMode>,
)
