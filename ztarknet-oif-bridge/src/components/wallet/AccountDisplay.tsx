import { useAccount, useBalance, useNetwork } from '@starknet-react/core'

export function AccountDisplay() {
  const { address, isConnected } = useAccount()
  const { chain } = useNetwork()
  const { data: balance, isLoading } = useBalance({
    address,
    token: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH token address
    watch: true,
  })

  if (!isConnected) return null

  return (
    <div className="account-info">
      <div className="chain-badge">{chain?.name || 'Unknown Network'}</div>
      <div className="address" title={address}>
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </div>
      {!isLoading && balance && (
        <div className="balance">
          {(Number(balance.value) / 1e18).toFixed(4)} ETH
        </div>
      )}
    </div>
  )
}
