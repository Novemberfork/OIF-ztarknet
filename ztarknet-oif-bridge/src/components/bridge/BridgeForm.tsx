import { useState, useEffect, useCallback } from 'react'
import { useAccount as useEvmAccount, useBalance as useEvmBalance, useChainId } from 'wagmi'
import { useAccount as useStarknetAccount } from '@starknet-react/core'
import { mainnet, sepolia, arbitrum, arbitrumSepolia } from 'wagmi/chains'
import { parseEther, type Address } from 'viem'

import { useHyperlane7683 } from '@/hooks/useHyperlane7683'
import { useTokenApproval } from '@/hooks/useTokenApproval'
import { useOrderStatus } from '@/hooks/useOrderStatus'
import { useBridgeStore } from '@/store'
import { TransferStatus } from '@/types/transfers'
import { EVM_CONTRACTS, CHAIN_IDS, HYPERLANE_DOMAINS, contracts } from '@/config/contracts'
import { TransactionStatus } from './TransactionStatus'

const chains = [mainnet, sepolia, arbitrum, arbitrumSepolia]

export function BridgeForm() {
  const { address: evmAddress, isConnected: evmConnected } = useEvmAccount()
  const { address: starknetAddress, isConnected: starknetConnected } = useStarknetAccount()
  const chainId = useChainId()
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')

  const { data: balance } = useEvmBalance({ address: evmAddress })

  // Hooks
  const { openOrder } = useHyperlane7683()
  const {
    checkAllowance,
    approve,
    isApproving,
    needsApproval,
  } = useTokenApproval()
  const { startPolling, status: orderStatus } = useOrderStatus()

  // Store
  const {
    currentTransfer,
    isTransferLoading,
    initTransfer,
    updateTransferStatus,
    setTransferLoading,
    resetCurrentTransfer,
  } = useBridgeStore()

  const currentChain = chains.find(c => c.id === chainId)
  const formattedBalance = balance ? (Number(balance.value) / 10 ** balance.decimals).toFixed(4) : '0'

  // Auto-fill recipient when starknet wallet connects
  useEffect(() => {
    if (starknetAddress && !recipient) {
      setRecipient(starknetAddress)
    }
  }, [starknetAddress, recipient])

  // Update transfer status when order status changes
  useEffect(() => {
    if (currentTransfer && orderStatus === 'filled') {
      updateTransferStatus(TransferStatus.Fulfilled)
    } else if (currentTransfer && orderStatus === 'settled') {
      updateTransferStatus(TransferStatus.Completed)
    }
  }, [orderStatus, currentTransfer, updateTransferStatus])

  const handleBridge = useCallback(async () => {
    if (!evmAddress || !starknetAddress || !amount || parseFloat(amount) <= 0) {
      return
    }

    setTransferLoading(true)

    try {
      const amountWei = parseEther(amount)

      // Initialize transfer in store
      initTransfer({
        originChain: currentChain?.name || 'Sepolia',
        originChainId: chainId,
        destinationChain: 'Ztarknet',
        destinationChainId: CHAIN_IDS.ztarknet,
        originToken: '0x0000000000000000000000000000000000000000' as Address, // ETH
        destinationToken: contracts['ztarknet'].erc20,
        amount,
        amountRaw: amountWei.toString(),
        sender: evmAddress,
        recipient,
      })

      updateTransferStatus(TransferStatus.Preparing)

      // For ETH transfers, we might not need approval
      // But for ERC20 tokens, check and approve if needed
      const tokenAddress = EVM_CONTRACTS.testToken
      const spenderAddress = EVM_CONTRACTS.hyperlane7683

      // Skip approval check for native ETH
      const isNativeETH = tokenAddress === '0x...' // Placeholder check

      if (!isNativeETH) {
        updateTransferStatus(TransferStatus.CheckingApproval)
        const needsApprove = await checkAllowance(tokenAddress, spenderAddress, amountWei)

        if (needsApprove) {
          updateTransferStatus(TransferStatus.WaitingApprovalSignature)
          const approvalTx = await approve(tokenAddress, spenderAddress)
          updateTransferStatus(TransferStatus.ApprovalConfirming, {
            approvalTxHash: approvalTx,
          })
        }
      }

      // Now submit the bridge transaction
      updateTransferStatus(TransferStatus.WaitingBridgeSignature)

      // Get origin domain (Sepolia = 11155111)
      const originDomain = HYPERLANE_DOMAINS.ethereumSepolia
      const destinationDomain = HYPERLANE_DOMAINS.ztarknet

      const result = await openOrder({
        senderAddress: evmAddress,
        recipientAddress: recipient,
        inputToken: '0x0000000000000000000000000000000000000000' as Address, // Native ETH
        outputToken: contracts['ztarknet'].erc20,
        amountIn: amountWei,
        amountOut: amountWei, // 1:1 for now
        originDomain,
        destinationDomain,
      })

      updateTransferStatus(TransferStatus.BridgeConfirming, {
        originTxHash: result.txHash,
        orderId: result.orderId,
      })

      // Start polling for fulfillment
      updateTransferStatus(TransferStatus.WaitingForFulfillment)
      startPolling(result.orderId)

    } catch (error) {
      console.error('Bridge failed:', error)
      updateTransferStatus(TransferStatus.Failed, {
        error: error instanceof Error ? error.message : 'Bridge transaction failed',
      })
    } finally {
      setTransferLoading(false)
    }
  }, [
    evmAddress,
    starknetAddress,
    amount,
    chainId,
    currentChain,
    recipient,
    initTransfer,
    updateTransferStatus,
    setTransferLoading,
    checkAllowance,
    approve,
    openOrder,
    startPolling,
  ])

  const handleMax = () => {
    if (balance) {
      setAmount((Number(balance.value) / 10 ** balance.decimals).toString())
    }
  }

  const handleSelf = () => {
    if (starknetAddress) {
      setRecipient(starknetAddress)
    }
  }

  const handleReset = () => {
    resetCurrentTransfer()
    setAmount('')
  }

  const isValidRecipient = recipient.startsWith('0x') && recipient.length === 66
  const bothWalletsConnected = evmConnected && starknetConnected
  const canBridge = bothWalletsConnected &&
                    amount &&
                    parseFloat(amount) > 0 &&
                    isValidRecipient &&
                    !isTransferLoading

  // Show transaction status when transfer is in progress
  if (currentTransfer && currentTransfer.status !== TransferStatus.Idle) {
    return (
      <div className="bridge-form">
        <TransactionStatus
          transfer={currentTransfer}
          onClose={currentTransfer.status === TransferStatus.Completed ||
                   currentTransfer.status === TransferStatus.Failed
                   ? handleReset : undefined}
        />

        {(currentTransfer.status === TransferStatus.Completed ||
          currentTransfer.status === TransferStatus.Failed) && (
          <button className="btn btn-primary bridge-btn" onClick={handleReset}>
            New Bridge
          </button>
        )}
      </div>
    )
  }

  if (!evmConnected && !starknetConnected) {
    return (
      <div className="bridge-form">
        <div className="bridge-empty">
          <div className="lock-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <p>Connect both wallets to bridge</p>
          <p className="hint">EVM wallet for source, Ztarknet for destination</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bridge-form">
      {/* Source - EVM/Public */}
      <div className={`bridge-side bridge-public ${!evmConnected ? 'disconnected' : ''}`}>
        <div className="side-header">
          <span className="side-label">From</span>
          <span className="side-tag exposed">Public</span>
        </div>
        <div className="side-chain">{currentChain?.name || 'EVM'}</div>
        {evmConnected && evmAddress ? (
          <div className="address-preview">
            <span className="address-full">{evmAddress}</span>
          </div>
        ) : (
          <div className="connect-prompt">Connect EVM wallet ↑</div>
        )}
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

      {/* Destination - Ztarknet/Private */}
      <div className={`bridge-side bridge-private ${!starknetConnected ? 'disconnected' : ''}`}>
        <div className="side-header">
          <span className="side-label">To</span>
          <span className="side-tag shielded">Private</span>
        </div>
        <div className="side-chain">Ztarknet</div>
        <div className="recipient-row">
          <input
            type="text"
            className="recipient-input"
            placeholder="0x... (Starknet address)"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
          {starknetConnected && (
            <button
              className="self-btn"
              onClick={handleSelf}
              title="Use connected wallet address"
            >
              Self
            </button>
          )}
        </div>
      </div>

      {/* Amount Input */}
      <div className="amount-section">
        <div className="amount-header">
          <span>Amount to shield</span>
          <button className="max-btn" onClick={handleMax} disabled={!evmConnected}>
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
            disabled={!evmConnected || isTransferLoading}
          />
          <span className="token-label">ETH</span>
        </div>
        {evmConnected && (
          <div className="balance-row">
            <span>Available: {formattedBalance} {balance?.symbol || 'ETH'}</span>
          </div>
        )}
      </div>

      <button
        className="btn btn-primary bridge-btn"
        onClick={handleBridge}
        disabled={!canBridge}
      >
        {isTransferLoading ? (
          <span className="loading-text">
            <span className="spinner"></span>
            Processing...
          </span>
        ) : !evmConnected ? (
          'Connect EVM Wallet'
        ) : !starknetConnected ? (
          'Connect Ztarknet Wallet'
        ) : isApproving ? (
          'Approving...'
        ) : needsApproval ? (
          'Approve & Shield'
        ) : (
          'Shield Assets'
        )}
      </button>

      <div className="privacy-note">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span>Your assets will be private on Ztarknet</span>
      </div>
    </div>
  )
}
