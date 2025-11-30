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
    // Clear recipient if switching chain types
    if (chain.type !== sourceChain?.type) {
      setRecipient('')
    }
  }

  const handleDestChainSelect = (chain: ChainOption) => {
    setDestChain(chain)
    // Auto-fill recipient based on new destination type
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

    // Validate source wallet connection
    if (!isSourceWalletConnected) {
      console.error('Source wallet not connected')
      return
    }

    setTransferLoading(true)

    try {
      const amountWei = parseEther(amount)

      // Initialize transfer in store
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

      // Get domain IDs
      const originDomain = getHyperlaneDomain(sourceChain.chainId)
      const destinationDomain = getHyperlaneDomain(destChain.chainId)

      if (!originDomain || !destinationDomain) {
        throw new Error('Invalid chain configuration')
      }

      // Handle EVM source chain
      if (sourceChain.type === 'evm') {
        const tokenAddress = sourceTokenAddress as Address
        const spenderAddress = EVM_CONTRACTS.hyperlane7683

        // Check and approve token if needed
        updateTransferStatus(TransferStatus.CheckingApproval)
        const needsApprove = await checkAllowance(tokenAddress, spenderAddress, amountWei)

        if (needsApprove) {
          updateTransferStatus(TransferStatus.WaitingApprovalSignature)
          const approvalTx = await approve(tokenAddress, spenderAddress)
          updateTransferStatus(TransferStatus.ApprovalConfirming, {
            approvalTxHash: approvalTx,
          })

          // Re-verify approval
          const stillNeedsApprove = await checkAllowance(tokenAddress, spenderAddress, amountWei)
          if (stillNeedsApprove) {
            throw new Error('Token approval failed or was insufficient')
          }
        }

        // Submit bridge transaction
        updateTransferStatus(TransferStatus.WaitingBridgeSignature)

        const result = await openOrder({
          senderAddress: evmAddress!,
          recipientAddress: recipient,
          inputToken: tokenAddress,
          outputToken: destTokenAddress || contracts['ztarknet'].erc20,
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
      } else {
        // Handle Starknet source chain (future implementation)
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

  // Validate recipient address based on destination chain type
  const isValidRecipient = useMemo(() => {
    if (!recipient || !destChain) return false
    if (destChain.type === 'starknet') {
      return recipient.startsWith('0x') && recipient.length === 66
    }
    // EVM address validation
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

  // Determine what wallet connections are needed
  const needsEvmWallet = sourceWalletType === 'evm' || destWalletType === 'evm'
  const needsStarknetWallet = sourceWalletType === 'starknet' || destWalletType === 'starknet'

  return (
    <div className="bridge-form">
      {/* Source Chain Selection */}
      <div className={`bridge-side bridge-source ${!isSourceWalletConnected && sourceChain ? 'disconnected' : ''}`}>
        <ChainSelector
          label="From"
          selectedChain={sourceChain}
          chains={chainOptions}
          onSelect={handleSourceChainSelect}
          excludeChainId={destChain?.chainId}
        />
        {sourceChain && (
          <div className="chain-wallet-status">
            {isSourceWalletConnected ? (
              <div className="address-preview">
                <span className="address-full">{senderAddress}</span>
              </div>
            ) : (
              <div className="connect-prompt">
                Connect {sourceChain.type === 'evm' ? 'EVM' : 'Starknet'} wallet above
              </div>
            )}
          </div>
        )}
      </div>

      {/* Swap Button */}
      <div className="bridge-transition">
        <div className="transition-line"></div>
        <button
          className="swap-chains-btn"
          onClick={handleSwapChains}
          disabled={!sourceChain && !destChain}
          title="Swap chains"
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 16V4M7 4L3 8M7 4L11 8"/>
            <path d="M17 8V20M17 20L21 16M17 20L13 16"/>
          </svg>
        </button>
        <div className="transition-line"></div>
      </div>

      {/* Destination Chain Selection */}
      <div className={`bridge-side bridge-dest ${destChain?.isPrivate ? 'bridge-private' : ''}`}>
        <ChainSelector
          label="To"
          selectedChain={destChain}
          chains={chainOptions}
          onSelect={handleDestChainSelect}
          excludeChainId={sourceChain?.chainId}
        />
        {destChain && (
          <>
            {destChain.isPrivate && (
              <span className="side-tag shielded">Private</span>
            )}
            <div className="recipient-row">
              <input
                type="text"
                className="recipient-input"
                placeholder={destChain.type === 'starknet' ? '0x... (Starknet address)' : '0x... (EVM address)'}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
              {isDestWalletConnected && (
                <button
                  className="self-btn"
                  onClick={handleSelf}
                  title="Use connected wallet address"
                  type="button"
                >
                  Self
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Amount Input */}
      <div className="amount-section">
        <div className="amount-header">
          <span>Amount to bridge</span>
          <button
            className="max-btn"
            onClick={handleMax}
            disabled={!isSourceWalletConnected || sourceWalletType !== 'evm'}
            type="button"
          >
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
            disabled={!sourceChain || isTransferLoading}
          />
          <span className="token-label">DOG</span>
        </div>
        {isSourceWalletConnected && sourceWalletType === 'evm' && (
          <div className="balance-row">
            <span>Available: {displayBalance} DOG</span>
          </div>
        )}
      </div>

      {/* Wallet Connection Hints */}
      {(sourceChain || destChain) && (!evmConnected && needsEvmWallet || !starknetConnected && needsStarknetWallet) && (
        <div className="wallet-hints">
          {!evmConnected && needsEvmWallet && (
            <div className="wallet-hint evm">Connect EVM wallet</div>
          )}
          {!starknetConnected && needsStarknetWallet && (
            <div className="wallet-hint starknet">Connect Starknet wallet</div>
          )}
        </div>
      )}

      <button
        className="btn btn-primary bridge-btn"
        onClick={handleBridge}
        disabled={!canBridge}
        type="button"
      >
        {isTransferLoading ? (
          <span className="loading-text">
            <span className="spinner"></span>
            Processing...
          </span>
        ) : !sourceChain || !destChain ? (
          'Select Chains'
        ) : !isSourceWalletConnected ? (
          `Connect ${sourceChain.type === 'evm' ? 'EVM' : 'Starknet'} Wallet`
        ) : isApproving ? (
          'Approving...'
        ) : needsApproval ? (
          'Approve & Bridge'
        ) : (
          'Bridge'
        )}
      </button>

      {destChain?.isPrivate && (
        <div className="privacy-note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span>Your assets will be private on {destChain.name}</span>
        </div>
      )}
    </div>
  )
}
