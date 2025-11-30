import { useState } from 'react'
import { useAccount, useConnect, useDisconnect } from '@starknet-react/core'

export function WalletButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [showModal, setShowModal] = useState(false)

  if (isConnected && address) {
    return (
      <div className="wallet-connected">
        <span className="address">{address.slice(0, 6)}...{address.slice(-4)}</span>
        <button className="btn" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setShowModal(true)}>
        Connect
      </button>

      {showModal && (
        <div className="wallet-select-overlay" onClick={() => setShowModal(false)}>
          <div className="wallet-select" onClick={(e) => e.stopPropagation()}>
            <h3>Connect Wallet</h3>
            <div className="wallet-list">
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  className="wallet-option"
                  onClick={() => {
                    connect({ connector })
                    setShowModal(false)
                  }}
                >
                  {connector.name}
                </button>
              ))}
            </div>
            <button className="cancel-btn" onClick={() => setShowModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}
