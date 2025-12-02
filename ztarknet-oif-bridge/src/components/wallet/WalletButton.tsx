import { useState } from 'react'
import { useAccount as useEvmAccount, useConnect as useEvmConnect, useDisconnect as useEvmDisconnect } from 'wagmi'
import { useAccount as useStarknetAccount, useConnect as useStarknetConnect, useDisconnect as useStarknetDisconnect } from '@starknet-react/core'
import { useBridgeStore } from '@/store'

type WalletType = 'evm' | 'starknet' | null

export function WalletButton() {
  const { address: evmAddress, isConnected: evmConnected } = useEvmAccount()
  const { connect: evmConnect, connectors: evmConnectors } = useEvmConnect()
  const { disconnect: evmDisconnect } = useEvmDisconnect()

  const { address: starknetAddress, isConnected: starknetConnected } = useStarknetAccount()
  const { connect: starknetConnect, connectors: starknetConnectors } = useStarknetConnect()
  const { disconnect: starknetDisconnect } = useStarknetDisconnect()
  const { currentTransfer } = useBridgeStore()

  const [showModal, setShowModal] = useState(false)
  const [walletType, setWalletType] = useState<WalletType>(null)

  const openModal = (type: WalletType) => {
    setWalletType(type)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setWalletType(null)
  }

  
  const { selectedOriginChainId } = useBridgeStore()
  const isZtarknetMode = selectedOriginChainId === 10066329 // Ztarknet Chain ID

  return (
    <>
      <div className="wallet-buttons">
        {/* EVM Wallet */}
        {evmConnected && evmAddress ? (
          <div className="wallet-connected evm">
            <span className="wallet-label">EVM</span>
            <span className="address">{evmAddress.slice(0, 6)}...{evmAddress.slice(-4)}</span>
            <button className="disconnect-btn" onClick={() => evmDisconnect()}>×</button>
          </div>
        ) : (
          <button className="btn" onClick={() => openModal('evm')}>
            Connect EVM
          </button>
        )}

        {/* Starknet Wallet */}
        {starknetConnected && starknetAddress ? (
          <div className={`wallet-connected ${isZtarknetMode ? 'ztarknet' : 'starknet'}`}>
            <span className="wallet-label">{isZtarknetMode ? 'ZK' : 'SN'}</span>
            <span className="address">{starknetAddress.slice(0, 6)}...{starknetAddress.slice(-4)}</span>
            <button className="disconnect-btn" onClick={() => starknetDisconnect()}>×</button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => openModal('starknet')}>
            Connect Z/Starknet
          </button>
        )}
      </div>

      {showModal && (
        <div className="wallet-select-overlay" onClick={closeModal}>
          <div className="wallet-select" onClick={(e) => e.stopPropagation()}>
            <h3>
              {walletType === 'evm' ? 'Connect EVM Wallet' : 'Connect Z/Starknet Wallet'}
            </h3>
            <div className="wallet-list">
              {walletType === 'evm' ? (
                evmConnectors.map((connector) => (
                  <button
                    key={connector.uid}
                    className="wallet-option"
                    onClick={() => {
                      evmConnect({ connector })
                      closeModal()
                    }}
                  >
                    {connector.name}
                  </button>
                ))
              ) : (
                starknetConnectors.map((connector) => (
                  <button
                    key={connector.id}
                    className="wallet-option"
                    onClick={() => {
                      starknetConnect({ connector })
                      closeModal()
                    }}
                  >
                    {connector.name}
                  </button>
                ))
              )}
            </div>
            <button className="cancel-btn" onClick={closeModal}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}
