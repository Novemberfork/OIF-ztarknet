import { useNetwork } from '@starknet-react/core'

export function NetworkSwitcher() {
  const { chain } = useNetwork()

  // Note: Network switching in Starknet wallets is typically done
  // in the wallet extension itself, not programmatically

  return (
    <div className="network-display">
      <span className="network-indicator"></span>
      <span>{chain?.name || 'Not Connected'}</span>
    </div>
  )
}
