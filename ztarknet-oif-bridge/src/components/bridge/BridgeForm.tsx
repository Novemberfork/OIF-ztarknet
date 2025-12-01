import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAccount as useEvmAccount, useChainId, useReadContract, useSwitchChain } from 'wagmi'
import { useAccount as useStarknetAccount } from '@starknet-react/core'
import { parseEther, formatUnits, type Address, erc20Abi } from 'viem'

import { useHyperlane7683 } from '@/hooks/useHyperlane7683'
import { useTokenApproval } from '@/hooks/useTokenApproval'
import { useOrderStatus } from '@/hooks/useOrderStatus'
import { useBridgeStore } from '@/store'
import { TransferStatus } from '@/types/transfers'
import {
  EVM_CONTRACTS,
  contracts,
  BRIDGE_CHAINS,
  getHyperlaneDomain,
  getTokenAddressForChain,
} from '@/config/contracts'
import { TransactionStatus } from './TransactionStatus'
import { ChainSelector, type ChainOption } from './ChainSelector'

// Convert BridgeChain to ChainOption for the selector
const chainOptions: ChainOption[] = BRIDGE_CHAINS.map(chain => ({
  id: chain.id,
  name: chain.name,
  chainId: chain.chainId,
  type: chain.type,
  isPrivate: chain.isPrivate,
}))

export function BridgeForm() {
  const { address: evmAddress, isConnected: evmConnected } = useEvmAccount()
  const { address: starknetAddress, isConnected: starknetConnected } = useStarknetAccount()
  const evmChainId = useChainId()
  const { switchChain } = useSwitchChain()

  const [sourceChain, setSourceChain] = useState<ChainOption | null>(null)
  const [destChain, setDestChain] = useState<ChainOption | null>(null)
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')

  // Determine which wallet is needed for source/destination
  const sourceWalletType = sourceChain?.type
  const destWalletType = destChain?.type

  // Check if the correct wallet is connected for each chain
  const isSourceWalletConnected = sourceWalletType === 'evm' ? evmConnected : starknetConnected
  const isDestWalletConnected = destWalletType === 'evm' ? evmConnected : starknetConnected

  // Get the sender address based on source chain type
  const senderAddress = sourceWalletType === 'evm' ? evmAddress : starknetAddress

  // Get token address for source chain
  const sourceTokenAddress = useMemo(() => {
    if (!sourceChain) return undefined
    return getTokenAddressForChain(sourceChain.chainId)
  }, [sourceChain])

  // Get token address for destination chain
  const destTokenAddress = useMemo(() => {
    if (!destChain) return undefined
    return getTokenAddressForChain(destChain.chainId)
  }, [destChain])

  // Read balance for EVM source chains
  const { data: evmBalance } = useReadContract({
    address: sourceTokenAddress as Address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: evmAddress ? [evmAddress] : undefined,
    query: {
      enabled: !!evmAddress && sourceWalletType === 'evm' && !!sourceTokenAddress,
    },
  })

  const { openOrder } = useHyperlane7683()
  const {
    checkAllowance,
    approve,
    isApproving,
    needsApproval,
  } = useTokenApproval()
  const { startPolling, status: orderStatus } = useOrderStatus()

  const {
    currentTransfer,
    isTransferLoading,
    initTransfer,
    updateTransferStatus,
    setTransferLoading,
    resetCurrentTransfer,
  } = useBridgeStore()

  const formattedBalance = evmBalance ? formatUnits(evmBalance, 18) : '0'
  const displayBalance = Number(formattedBalance).toFixed(4)

  // Auto-switch EVM network when source chain changes
  useEffect(() => {
    if (sourceChain?.type === 'evm' && evmConnected && evmChainId !== sourceChain.chainId) {
      switchChain({ chainId: sourceChain.chainId })
    }
  }, [sourceChain, evmConnected, evmChainId, switchChain])

  // Auto-fill recipient when destination wallet connects
  useEffect(() => {
    if (!recipient) {
      if (destWalletType === 'starknet' && starknetAddress) {
        setRecipient(starknetAddress)
      } else if (destWalletType === 'evm' && evmAddress) {
        setRecipient(evmAddress)
      }
    }
  }, [destWalletType, starknetAddress, evmAddress, recipient])

  // Update transfer status when order status changes
  useEffect(() => {
    if (currentTransfer && orderStatus === 'filled') {
      updateTransferStatus(TransferStatus.Fulfilled)
    } else if (currentTransfer && orderStatus === 'settled') {
      updateTransferStatus(TransferStatus.Completed)
    }
  }, [orderStatus, currentTransfer, updateTransferStatus])

  const handleSourceChainSelect = (chain: ChainOption) => {
    setSourceChain(chain)
    if (chain.type !== sourceChain?.type) {
      setRecipient('')
    }
  }

  const handleDestChainSelect = (chain: ChainOption) => {
    setDestChain(chain)
    setRecipient('')
    if (chain.type === 'starknet' && starknetAddress) {
      setRecipient(starknetAddress)
    } else if (chain.type === 'evm' && evmAddress) {
      setRecipient(evmAddress)
    }
  }

  const handleSwapChains = () => {
    const temp = sourceChain
    setSourceChain(destChain)
    setDestChain(temp)
    setRecipient('')
  }

  const handleBridge = useCallback(async () => {
    if (!sourceChain || !destChain || !senderAddress || !amount || parseFloat(amount) <= 0) {
      return
    }

    if (!isSourceWalletConnected) {
      console.error('Source wallet not connected')
      return
    }

    setTransferLoading(true)

    try {
      const amountWei = parseEther(amount)

      initTransfer({
        originChain: sourceChain.name,
        originChainId: sourceChain.chainId,
        destinationChain: destChain.name,
        destinationChainId: destChain.chainId,
        originToken: (sourceTokenAddress || '0x') as `0x${string}`,
        destinationToken: destTokenAddress || '',
        amount,
        amountRaw: amountWei.toString(),
        sender: (senderAddress || '0x') as `0x${string}`,
        recipient,
      })

      updateTransferStatus(TransferStatus.Preparing)

      const originDomain = getHyperlaneDomain(sourceChain.chainId)
      const destinationDomain = getHyperlaneDomain(destChain.chainId)

      if (!originDomain || !destinationDomain) {
        throw new Error('Invalid chain configuration')
      }

      if (sourceChain.type === 'evm') {
        const tokenAddress = sourceTokenAddress as Address
        const spenderAddress = EVM_CONTRACTS.hyperlane7683

        updateTransferStatus(TransferStatus.CheckingApproval)
        const needsApprove = await checkAllowance(tokenAddress, spenderAddress, amountWei)

        if (needsApprove) {
          updateTransferStatus(TransferStatus.WaitingApprovalSignature)
          const approvalTx = await approve(tokenAddress, spenderAddress)
          updateTransferStatus(TransferStatus.ApprovalConfirming, {
            approvalTxHash: approvalTx,
          })

          const stillNeedsApprove = await checkAllowance(tokenAddress, spenderAddress, amountWei)
          if (stillNeedsApprove) {
            throw new Error('Token approval failed or was insufficient')
          }
        }

        updateTransferStatus(TransferStatus.WaitingBridgeSignature)

        const result = await openOrder({
          senderAddress: evmAddress!,
          recipientAddress: recipient,
          inputToken: tokenAddress,
          outputToken: destTokenAddress || contracts['ztarknet'].erc20,
          amountIn: amountWei,
          amountOut: amountWei,
          originDomain,
          destinationDomain,
        })

        updateTransferStatus(TransferStatus.BridgeConfirming, {
          originTxHash: result.txHash,
          orderId: result.orderId,
        })

        updateTransferStatus(TransferStatus.WaitingForFulfillment)
        startPolling(result.orderId)
      } else {
        throw new Error('Starknet as source chain is not yet supported')
      }

    } catch (error) {
      console.error('Bridge failed:', error)
      updateTransferStatus(TransferStatus.Failed, {
        error: error instanceof Error ? error.message : 'Bridge transaction failed',
      })
    } finally {
      setTransferLoading(false)
    }
  }, [
    sourceChain,
    destChain,
    senderAddress,
    amount,
    recipient,
    sourceTokenAddress,
    destTokenAddress,
    isSourceWalletConnected,
    evmAddress,
    initTransfer,
    updateTransferStatus,
    setTransferLoading,
    checkAllowance,
    approve,
    openOrder,
    startPolling,
  ])

  const handleMax = () => {
    if (evmBalance && sourceWalletType === 'evm') {
      setAmount(formatUnits(evmBalance, 18))
    }
  }

  const handleSelf = () => {
    if (destWalletType === 'starknet' && starknetAddress) {
      setRecipient(starknetAddress)
    } else if (destWalletType === 'evm' && evmAddress) {
      setRecipient(evmAddress)
    }
  }

  const handleReset = () => {
    resetCurrentTransfer()
    setAmount('')
  }

  const isValidRecipient = useMemo(() => {
    if (!recipient || !destChain) return false
    if (destChain.type === 'starknet') {
      return recipient.startsWith('0x') && recipient.length === 66
    }
    return recipient.startsWith('0x') && recipient.length === 42
  }, [recipient, destChain])

  const canBridge = sourceChain &&
                    destChain &&
                    isSourceWalletConnected &&
                    amount &&
                    parseFloat(amount) > 0 &&
                    isValidRecipient &&
                    !isTransferLoading

  // Show transaction status when transfer is in progress
  if (currentTransfer && currentTransfer.status !== TransferStatus.Idle) {
    return (
      <div className="bridge-terminal">
        <TransactionStatus
          transfer={currentTransfer}
          onClose={currentTransfer.status === TransferStatus.Completed ||
                   currentTransfer.status === TransferStatus.Failed
                   ? handleReset : undefined}
        />

        {(currentTransfer.status === TransferStatus.Completed ||
          currentTransfer.status === TransferStatus.Failed) && (
          <button className="action-btn primary" onClick={handleReset}>
            <span className="btn-text">INITIATE NEW TRANSFER</span>
            <div className="btn-glow" />
          </button>
        )}
      </div>
    )
  }

  const needsEvmWallet = sourceWalletType === 'evm' || destWalletType === 'evm'
  const needsStarknetWallet = sourceWalletType === 'starknet' || destWalletType === 'starknet'

  return (
    <div className="bridge-terminal">
      {/* Origin Section */}
      <div className="terminal-section origin">
        <div className="section-header">
          <div className="section-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <span className="section-label">ORIGIN</span>
          {sourceChain && (
            <span className={`chain-type ${sourceChain.type}`}>{sourceChain.type.toUpperCase()}</span>
          )}
        </div>

        <ChainSelector
          label=""
          selectedChain={sourceChain}
          chains={chainOptions}
          onSelect={handleSourceChainSelect}
          excludeChainId={destChain?.chainId}
        />

        {sourceChain && isSourceWalletConnected && (
          <div className="wallet-info">
            <div className="wallet-address">
              <span className="address-label">SENDER</span>
              <span className="address-value">{senderAddress?.slice(0, 8)}...{senderAddress?.slice(-6)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Transfer Visualization */}
      <div className="transfer-visual">
        <div className="transfer-line">
          <div className="line-segment" />
          <div className="data-packet" />
          <div className="data-packet delay-1" />
          <div className="data-packet delay-2" />
        </div>
        <button
          className="swap-btn"
          onClick={handleSwapChains}
          disabled={!sourceChain && !destChain}
          title="Swap chains"
          type="button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 16V4M7 4L3 8M7 4L11 8"/>
            <path d="M17 8V20M17 20L21 16M17 20L13 16"/>
          </svg>
        </button>
        <div className="transfer-line">
          <div className="line-segment" />
        </div>
      </div>

      {/* Destination Section */}
      <div className={`terminal-section destination ${destChain?.isPrivate ? 'private' : ''}`}>
        <div className="section-header">
          <div className="section-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span className="section-label">DESTINATION</span>
          {destChain?.isPrivate && (
            <span className="privacy-tag">
              <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
              </svg>
              SHIELDED
            </span>
          )}
        </div>

        <ChainSelector
          label=""
          selectedChain={destChain}
          chains={chainOptions}
          onSelect={handleDestChainSelect}
          excludeChainId={sourceChain?.chainId}
        />

        {destChain && (
          <div className="recipient-section">
            <div className="recipient-header">
              <span className="recipient-label">RECIPIENT ADDRESS</span>
              {isDestWalletConnected && (
                <button className="self-btn" onClick={handleSelf} type="button">
                  USE CONNECTED
                </button>
              )}
            </div>
            <div className="recipient-input-wrapper">
              <input
                type="text"
                className="recipient-input"
                placeholder={destChain.type === 'starknet' ? '0x...' : '0x...'}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
              {recipient && (
                <div className={`input-status ${isValidRecipient ? 'valid' : 'invalid'}`}>
                  {isValidRecipient ? '✓' : '✗'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Amount Section */}
      <div className="amount-terminal">
        <div className="amount-display">
          <div className="amount-header">
            <span className="amount-label">TRANSFER AMOUNT</span>
            <button
              className="max-btn"
              onClick={handleMax}
              disabled={!isSourceWalletConnected || sourceWalletType !== 'evm'}
              type="button"
            >
              MAX
            </button>
          </div>
          <div className="amount-input-container">
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="amount-input"
              disabled={!sourceChain || isTransferLoading}
            />
            <div className="token-badge">
              <span className="token-symbol">DOG</span>
            </div>
          </div>
          {isSourceWalletConnected && sourceWalletType === 'evm' && (
            <div className="balance-display">
              <span className="balance-label">AVAILABLE</span>
              <span className="balance-value">{displayBalance} DOG</span>
            </div>
          )}
        </div>
      </div>

      {/* Wallet Connection Alerts */}
      {(sourceChain || destChain) && (!evmConnected && needsEvmWallet || !starknetConnected && needsStarknetWallet) && (
        <div className="connection-alerts">
          {!evmConnected && needsEvmWallet && (
            <div className="alert evm">
              <div className="alert-icon">!</div>
              <span>EVM WALLET REQUIRED</span>
            </div>
          )}
          {!starknetConnected && needsStarknetWallet && (
            <div className="alert starknet">
              <div className="alert-icon">!</div>
              <span>STARKNET WALLET REQUIRED</span>
            </div>
          )}
        </div>
      )}

      {/* Execute Button */}
      <button
        className={`action-btn primary ${canBridge ? 'ready' : ''}`}
        onClick={handleBridge}
        disabled={!canBridge}
        type="button"
      >
        <div className="btn-inner">
          {isTransferLoading ? (
            <>
              <div className="loading-spinner" />
              <span className="btn-text">PROCESSING</span>
            </>
          ) : !sourceChain || !destChain ? (
            <span className="btn-text">SELECT CHAINS</span>
          ) : !isSourceWalletConnected ? (
            <span className="btn-text">CONNECT WALLET</span>
          ) : isApproving ? (
            <span className="btn-text">APPROVING</span>
          ) : needsApproval ? (
            <span className="btn-text">APPROVE & EXECUTE</span>
          ) : (
            <span className="btn-text">EXECUTE TRANSFER</span>
          )}
        </div>
        <div className="btn-glow" />
        <div className="btn-scanline" />
      </button>

      {destChain?.isPrivate && (
        <div className="privacy-notice">
          <div className="notice-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
          </div>
          <span>Assets will be shielded on {destChain.name}</span>
        </div>
      )}
    </div>
  )
}
