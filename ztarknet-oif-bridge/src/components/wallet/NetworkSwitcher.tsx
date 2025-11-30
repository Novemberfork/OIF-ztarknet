import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { mainnet, sepolia, arbitrum, arbitrumSepolia } from 'wagmi/chains'

const chains = [mainnet, sepolia, arbitrum, arbitrumSepolia]

export function NetworkSwitcher() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  if (!isConnected) {
    return (
      <div className="network-display">
        <span className="network-indicator off"></span>
        <span>Not Connected</span>
      </div>
    )
  }

  return (
    <select
      className="network-select"
      value={chainId}
      onChange={(e) => switchChain({ chainId: Number(e.target.value) })}
    >
      {chains.map((chain) => (
        <option key={chain.id} value={chain.id}>
          {chain.name}
        </option>
      ))}
    </select>
  )
}
