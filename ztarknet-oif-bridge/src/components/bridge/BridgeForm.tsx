import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAccount as useEvmAccount, useChainId, useReadContract, useSwitchChain, useWriteContract } from 'wagmi'
import { useSendTransaction, useAccount as useStarknetAccount } from '@starknet-react/core'
import { parseEther, formatUnits, type Address, erc20Abi } from 'viem'
import { uint256 } from 'starknet'

import { useHyperlane7683 } from '@/hooks/useHyperlane7683'
import { useTokenApproval } from '@/hooks/useTokenApproval'
import { useOrderStatus } from '@/hooks/useOrderStatus'
import { useERC20 } from '@/hooks/useERC20'
import { useBridgeStore } from '@/store'
import MintableERC20Abi from '@/abis/MintableERC20.json'
import { TransferStatus } from '@/types/transfers'
import {
  computeOrderId
} from '@/utils/orderEncoding'
import {
  EVM_CONTRACTS,
  contracts,
  BRIDGE_CHAINS,
  getHyperlaneDomain,
  getTokenAddressForChain,
} from '@/config/contracts'
import { TransactionStatus } from './TransactionStatus'
import { ChainSelector, type ChainOption } from './ChainSelector'
import { ChainStats } from './ChainStats'
import { useOpenOrder } from '@/hooks/useOpenOrder'

interface OpenOrderParams {
  // User's addresses
  senderAddress: string      // Starknet sender address
  recipientAddress: string    // Starknet recipient (full felt)

  // Token info
  inputToken: string         // Origin chain token (EVM)
  outputToken: string         // Destination chain token (Starknet felt)
  amountIn: bigint            // Amount user sends
  amountOut: bigint           // Amount user receives

  // Chain info (using Hyperlane domains)
  originDomain: number
  destinationDomain: number
  destinationSettler?: string

  // Timing
  fillDeadlineSeconds?: number
}

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
  const [showOriginStats, setShowOriginStats] = useState(false)
  const [showDestStats, setShowDestStats] = useState(false)

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

  // Use Starknet ERC20 hook for source token balance
  // Pass chainId to enable manual fetching for both Ztarknet and Starknet Sepolia if configured
  const { balance: snBalance } = useERC20(
    sourceTokenAddress || '', 
    sourceChain?.type === 'starknet' ? sourceChain.chainId : undefined
  )
  console.log("snBalance", snBalance);

  // EVM Minting
  const { writeContractAsync: mintEvm, isPending: isMintingEvm } = useWriteContract()

  // Starknet Minting
  const { sendAsync: mintStarknet, isPending: isMintingStarknet } = useSendTransaction({})

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
    setSelectedOriginChainId,
  } = useBridgeStore()

  // Update store when source chain changes
  // Only update if the new source chain is Starknet or Ztarknet (type 'starknet')
  // This preserves the badge style (ZK or SN) when switching back to EVM origin
  useEffect(() => {
    if (sourceChain?.type === 'starknet') {
      setSelectedOriginChainId(sourceChain.chainId)
    }
  }, [sourceChain, setSelectedOriginChainId])

  // Starknet `open` mult-call

  const o: OpenOrderParams | null = useMemo(() => {
    const _domainO = sourceChain?.chainId;
    const _domainD = destChain?.chainId;

    if (!_domainO || !_domainD || sourceChain?.type !== 'starknet' || !starknetAddress) return null;

    const domainO = getHyperlaneDomain(_domainO);
    const domainD = getHyperlaneDomain(_domainD);

    const destContracts = contracts[destChain.id];
    const destinationSettler = destContracts?.hyperlane7683;

    // Fix for Ztarknet origin domain
    // If source is Ztarknet, origin domain should be 10066329 (0x999999)
    // getHyperlaneDomain handles this if chainId is correct, but we force it here to be safe
    // given the shared chainID issues with Starknet Sepolia
    const effectiveOriginDomain = sourceChain.id === 'ztarknet' ? 10066329 : domainO;

    let amountWei = 0n;
    try {
      amountWei = parseEther(amount || '0');
    } catch {
      // Ignore parse errors
    }
    const amountOut = amountWei > 0n ? amountWei - 1n : 0n;

    return {
      senderAddress: starknetAddress,
      recipientAddress: recipient,
      inputToken: sourceTokenAddress as `0x${string}`,
      outputToken: destTokenAddress || contracts['ztarknet'].erc20,
      amountIn: amountWei,
      amountOut: amountOut,
      originDomain: effectiveOriginDomain,
      destinationDomain: domainD,
      destinationSettler,
    } as OpenOrderParams
  }, [amount, destChain, sourceChain, destTokenAddress, sourceTokenAddress, recipient, starknetAddress]);

  const starknetHyperlaneAddress = useMemo(() => {
    if (sourceChain?.type !== 'starknet') return '';
    return contracts[sourceChain.id]?.hyperlane7683 || '';
  }, [sourceChain]);

  const { calls, orderData } = useOpenOrder(starknetHyperlaneAddress, o);
  const { sendAsync } = useSendTransaction({ calls });



  const formattedBalance = useMemo(() => {
    if (sourceWalletType === 'evm' && evmBalance) {
      return formatUnits(evmBalance, 18)
    } else if (sourceWalletType === 'starknet' && snBalance) {
      try {
        console.log("Processing snBalance:", snBalance);
        // snBalance is likely { low: ..., high: ... } from starknet-react
        // or a bigint directly. Let's check type.
        let balanceBN;
        if (typeof snBalance === 'bigint') {
          balanceBN = snBalance;
        } else {
          balanceBN = uint256.uint256ToBN(snBalance as any)
        }
        return formatUnits(balanceBN, 18)
      } catch (e) {
        console.error('Error formatting Starknet balance:', e)
        return '0'
      }
    }
    return '0'
  }, [evmBalance, snBalance, sourceWalletType])

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

        const amountOut = amountWei > 0n ? amountWei - 1n : 0n

        // Determine destination settler
        const destinationSettler = contracts[destChain.id]?.hyperlane7683 || EVM_CONTRACTS.hyperlane7683

        console.log('EVM Bridge Debug:', {
          destinationChainId: destChain.id,
          destinationSettler,
          originDomain,
          destinationDomain
        });

        const result = await openOrder({
          senderAddress: evmAddress!,
          recipientAddress: recipient,
          inputToken: tokenAddress,
          outputToken: destTokenAddress || contracts['ztarknet'].erc20,
          amountIn: amountWei,
          amountOut: amountOut,
          originDomain,
          destinationDomain,
          destinationSettler,
        })

        updateTransferStatus(TransferStatus.BridgeConfirming, {
          originTxHash: result.txHash,
          orderId: result.orderId,
        })

        updateTransferStatus(TransferStatus.WaitingForFulfillment)
        startPolling(result.orderId, destChain.chainId)
      } else if (sourceChain.type === 'starknet') {
        console.log("--- Starknet Bridge Debug ---");
        console.log("Pre-encoded Order Data:", orderData);
        console.log("Hyperlane Contract Address:", starknetHyperlaneAddress);
        console.log("Calldata/Calls:", calls);
        console.log("-----------------------------");

        updateTransferStatus(TransferStatus.WaitingBridgeSignature)
        const result = await sendAsync();

        updateTransferStatus(TransferStatus.BridgeConfirming, {
          originTxHash: result.transaction_hash as `0x${string}`,
        })

        // Wait for transaction to confirm using provider (not shown here, but sendAsync returns tx hash)
        // Ideally, you'd wait for receipt here or poll for it.
        // For now, assuming optimistic progression or using a listener elsewhere (like we do for EVM polling orderId, 
        // but Starknet might need tx receipt first to get orderId if emitted, or just poll solver with tx hash if supported).
        // Since we don't have the orderId easily from the sendAsync result (it's in the event), we might need to fetch receipt.

        // Simulating moving to next step after a short delay or if we implement receipt fetching
        // For proper implementation, we should fetch receipt to get logs -> orderId.

        // TEMPORARY: Just setting status to waiting for fulfillment
        // In a real implementation: const receipt = await provider.waitForTransaction(result.transaction_hash)

        updateTransferStatus(TransferStatus.WaitingForFulfillment)

        // Compute orderId for polling
        if (orderData) {
          const orderId = computeOrderId(orderData);
          console.log("Computed Order ID:", orderId);
          startPolling(orderId, destChain.chainId);
        }
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
    const isFinished = currentTransfer.status === TransferStatus.Completed ||
      currentTransfer.status === TransferStatus.Failed ||
      currentTransfer.status === TransferStatus.WaitingForFulfillment ||
      currentTransfer.status === TransferStatus.Fulfilled ||
      currentTransfer.status === TransferStatus.Settled

    return (
      <div className="bridge-terminal">
        <TransactionStatus
          transfer={currentTransfer}
          onClose={isFinished ? handleReset : undefined}
        />

        {isFinished && (
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

  const handleMint = useCallback(async () => {
    if (!sourceChain || !sourceTokenAddress) return

    // Amount to mint: 42,069 * 10^18
    const mintAmount = parseEther('42069')

    try {
      if (sourceChain.type === 'evm' && evmAddress) {
        console.log("Minting EVM:", {
          address: sourceTokenAddress,
          recipient: evmAddress,
          amount: mintAmount.toString()
        });
        await mintEvm({
          address: sourceTokenAddress as Address,
          abi: MintableERC20Abi,
          functionName: 'mint',
          args: [evmAddress, mintAmount],
        })
      } else if (sourceChain.type === 'starknet' && starknetAddress) {
        const amountUint256 = uint256.bnToUint256(mintAmount)
        console.log("Minting Starknet:", {
          contract: sourceTokenAddress,
          recipient: starknetAddress,
          amount: mintAmount.toString(),
          u256: amountUint256
        });
        await mintStarknet([{
          contractAddress: sourceTokenAddress,
          entrypoint: 'mint',
          calldata: [starknetAddress, amountUint256.low, amountUint256.high]
        }])
      }
    } catch (error) {
      console.error('Mint failed:', error)
    }
  }, [sourceChain, sourceTokenAddress, evmAddress, starknetAddress, mintEvm, mintStarknet])

  // Execute Button Text Logic
  const buttonText = useMemo(() => {
    if (isTransferLoading) return 'PROCESSING'
    if (isMintingEvm || isMintingStarknet) return 'MINTING...'
    if (!sourceChain || !destChain) return 'SELECT CHAINS'
    if (!isSourceWalletConnected) return 'CONNECT WALLET'

    // Check if balance is 0 or less than input amount (if amount entered)
    const currentBalance = formattedBalance ? parseFloat(formattedBalance) : 0
    const inputAmount = amount ? parseFloat(amount) : 0

    console.log("Button Logic:", {
      currentBalance,
      inputAmount,
      isApproving,
      needsApproval,
      formattedBalance,
      amount
    });

    // Show mint if balance is 0 OR if input amount > balance
    // This allows users to mint if they have 0 balance OR if they try to send more than they have
    if (currentBalance === 0 || (inputAmount > 0 && inputAmount > currentBalance)) {
      return 'MINT DOG COINS'
    }

    if (isApproving) return 'APPROVING'
    if (needsApproval) return 'APPROVE & EXECUTE'
    return 'EXECUTE TRANSFER'
  }, [isTransferLoading, isMintingEvm, isMintingStarknet, sourceChain, destChain, isSourceWalletConnected, formattedBalance, isApproving, needsApproval, amount])

  // Execute Button Click Handler
  const handleButtonClick = useCallback(() => {
    if (buttonText === 'MINT DOG COINS') {
      handleMint()
    } else {
      handleBridge()
    }
  }, [buttonText, handleMint, handleBridge])

  return (
    <div className="bridge-terminal">
      {/* Origin Section */}
      <div className={`terminal-section origin ${sourceChain?.isPrivate ? 'private' : ''}`}>
        <div className="section-header">
          <div className="section-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <span className="section-label">ORIGIN</span>
          {sourceChain && !sourceChain.isPrivate && (
            <span className={`chain-type ${sourceChain.id === 'ztarknet' ? 'ztarknet' : sourceChain.type}`}>
              {sourceChain.type === 'evm' ? 'EVM' : sourceChain.id === 'ztarknet' ? 'ZK' : 'SN'}
            </span>
          )}
          {sourceChain?.isPrivate && (
            <span className="privacy-tag">
              <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
              </svg>
              ZK
            </span>
          )}

          {sourceChain && (
            <>
              <button
                className={`stats-toggle-btn ${showOriginStats ? 'active' : ''}`}
                onClick={() => setShowOriginStats(!showOriginStats)}
                type="button"
                title={showOriginStats ? "Hide stats" : "Show stats"}
              >
                {showOriginStats ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </button>
            </>
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

        {/* Chain Stats for Origin */}
        {showOriginStats && <ChainStats chain={sourceChain} position="origin" />}
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
            <path d="M7 16V4M7 4L3 8M7 4L11 8" />
            <path d="M17 8V20M17 20L21 16M17 20L13 16" />
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
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span className="section-label">DESTINATION</span>
          {destChain && !destChain.isPrivate && (
            <span className={`chain-type ${destChain.id === 'ztarknet' ? 'ztarknet' : destChain.type}`}>
              {destChain.type === 'evm' ? 'EVM' : destChain.id === 'ztarknet' ? 'ZK' : 'SN'}
            </span>
          )}
          {destChain?.isPrivate && (
            <span className="privacy-tag">
              <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
              </svg>
              ZK
            </span>
          )}
          {destChain && (
            <button
              className={`stats-toggle-btn ${showDestStats ? 'active' : ''}`}
              onClick={() => setShowDestStats(!showDestStats)}
              type="button"
              title={showDestStats ? "Hide stats" : "Show stats"}
            >
              {showDestStats ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              )}
            </button>
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

        {/* Chain Stats for Destination */}
        {showDestStats && <ChainStats chain={destChain} position="destination" />}
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
              type="number"
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
          {isSourceWalletConnected && (
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
        className={`action-btn primary ${canBridge || buttonText === 'MINT DOG COINS' ? 'ready' : ''}`}
        onClick={handleButtonClick}
        disabled={(!canBridge && buttonText !== 'MINT DOG COINS') || isTransferLoading || isMintingEvm || isMintingStarknet}
        type="button"
      >
        <div className="btn-inner">
          {(isTransferLoading || isMintingEvm || isMintingStarknet) && <div className="loading-spinner" />}
          <span className="btn-text">{buttonText}</span>
        </div>
        <div className="btn-glow" />
        <div className="btn-scanline" />
      </button>

      {destChain?.isPrivate && (
        <div className="privacy-notice">
          <div className="notice-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <span>Assets will be shielded on {destChain.name}</span>
        </div>
      )}
    </div>
  )
}
