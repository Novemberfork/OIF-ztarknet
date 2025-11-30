import { useState } from 'react'
import { useAccount, useBalance } from '@starknet-react/core'

export function BridgeForm() {
  const { address, isConnected } = useAccount()
  const [amount, setAmount] = useState('')

  const { data: balance } = useBalance({
    address,
    token: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    watch: true,
  })

  const formattedBalance = balance ? (Number(balance.value) / 1e18).toFixed(4) : '0'

  const handleBridge = () => {
    console.log('Bridge:', { amount })
  }

  const handleMax = () => {
    if (balance) {
      setAmount((Number(balance.value) / 1e18).toString())
    }
  }

  if (!isConnected) {
    return (
      <div className="bridge-form">
        <div className="bridge-empty">
          <div className="lock-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <p>Connect wallet to shield assets</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bridge-form">
      {/* Source - Public/Exposed */}
      <div className="bridge-side bridge-public">
        <div className="side-header">
          <span className="side-label">Public</span>
          <span className="side-tag exposed">Exposed</span>
        </div>
        <div className="side-chain">Starknet</div>
        <div className="address-preview">
          <span className="address-full">{address}</span>
        </div>
      </div>

      {/* Transition Arrow */}
      <div className="bridge-transition">
        <div className="transition-line"></div>
        <div className="transition-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L12 22M12 22L6 16M12 22L18 16"/>
          </svg>
        </div>
        <div className="transition-line"></div>
      </div>

      {/* Destination - Private/Shielded */}
      <div className="bridge-side bridge-private">
        <div className="side-header">
          <span className="side-label">Private</span>
          <span className="side-tag shielded">Shielded</span>
        </div>
        <div className="side-chain">zStarknet</div>
        <div className="address-preview redacted">
          <span>████████████████████████</span>
        </div>
      </div>

      {/* Amount Input */}
      <div className="amount-section">
        <div className="amount-header">
          <span>Amount to shield</span>
          <button className="max-btn" onClick={handleMax}>
            MAX
          </button>
        </div>
        <div className="amount-input-wrapper">
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="amount-input"
          />
          <span className="token-label">ETH</span>
        </div>
        <div className="balance-row">
          <span>Available: {formattedBalance} ETH</span>
        </div>
      </div>

      <button
        className="btn btn-primary bridge-btn"
        onClick={handleBridge}
        disabled={!amount || parseFloat(amount) <= 0}
      >
        Shield Assets
      </button>

      <div className="privacy-note">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span>Your transaction will be private on zStarknet</span>
      </div>
    </div>
  )
}
