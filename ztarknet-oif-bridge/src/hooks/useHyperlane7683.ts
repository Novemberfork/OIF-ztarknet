import { useCallback } from 'react'
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useChainId,
} from 'wagmi'
import {
  type Hex,
  type Address,
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  toHex,
  pad,
  numberToHex,
} from 'viem'
import Hyperlane7683Abi from '@/abis/Hyperlane7683.json'
import {
  EVM_CONTRACTS,
  OPEN_EVENT_TOPIC,
  HYPERLANE_DOMAINS,
  contracts,
} from '@/config/contracts'
import type { OnchainCrossChainOrder } from '@/types/orders'

// Order data type hash - must match solver's OrderEncoder.orderDataType() EXACTLY
const ORDER_DATA_TYPE_STRING = 'OrderData(bytes32 sender,bytes32 recipient,bytes32 inputToken,bytes32 outputToken,uint256 amountIn,uint256 amountOut,uint256 senderNonce,uint32 originDomain,uint32 destinationDomain,bytes32 destinationSettler,uint32 fillDeadline,bytes data)'
const ORDER_DATA_TYPE_HASH = keccak256(toHex(ORDER_DATA_TYPE_STRING))

interface OpenOrderParams {
  // User's addresses
  senderAddress: Address      // EVM sender address
  recipientAddress: string    // Starknet recipient (full felt)

  // Token info
  inputToken: Address         // Origin chain token (EVM)
  outputToken: string         // Destination chain token (Starknet felt)
  amountIn: bigint            // Amount user sends
  amountOut: bigint           // Amount user receives

  // Chain info (using Hyperlane domains)
  originDomain: number
  destinationDomain: number

  // Timing
  fillDeadlineSeconds?: number
}

interface OpenOrderResult {
  txHash: Hex
  orderId: Hex
}

/**
 * Convert an EVM address to bytes32 (left-padded with zeros)
 */
function evmAddressToBytes32(address: Address): Hex {
  return pad(address, { size: 32 }) as Hex
}

/**
 * Convert a Starknet felt/address to bytes32
 */
function feltToBytes32(felt: string): Hex {
  const cleaned = felt.startsWith('0x') ? felt.slice(2) : felt
  return `0x${cleaned.padStart(64, '0')}` as Hex
}

export function useHyperlane7683() {
  const { address } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  /**
   * Check if a nonce is valid for the user
   */
  const isValidNonce = useCallback(async (userAddress: Address, nonce: bigint): Promise<boolean> => {
    if (!publicClient) return false

    try {
      const result = await publicClient.readContract({
        address: EVM_CONTRACTS.hyperlane7683,
        abi: Hyperlane7683Abi,
        functionName: 'isValidNonce',
        args: [userAddress, nonce],
      })
      return result as boolean
    } catch {
      return false
    }
  }, [publicClient])

  /**
   * Find a valid nonce for the user
   */
  const findValidNonce = useCallback(async (userAddress: Address): Promise<bigint> => {
    // Start with current timestamp mod 1M as seed
    let nonce = BigInt(Math.floor(Date.now() / 1000) % 1_000_000)
    if (nonce < 1n) nonce = 1n

    for (let i = 0; i < 100; i++) {
      const valid = await isValidNonce(userAddress, nonce)
      if (valid) return nonce
      nonce += 1n
    }

    throw new Error('Could not find a valid nonce after 100 attempts')
  }, [isValidNonce])

  /**
   * Get the local domain from the contract
   */
  const getLocalDomain = useCallback(async (): Promise<number> => {
    if (!publicClient) throw new Error('Public client not available')

    const domain = await publicClient.readContract({
      address: EVM_CONTRACTS.hyperlane7683,
      abi: Hyperlane7683Abi,
      functionName: 'localDomain',
    })
    return Number(domain)
  }, [publicClient])

  /**
   * Encode order data matching the solver's expected format
   */
  const encodeOrderData = useCallback((params: {
    sender: Hex           // bytes32
    recipient: Hex        // bytes32
    inputToken: Hex       // bytes32
    outputToken: Hex      // bytes32
    amountIn: bigint
    amountOut: bigint
    senderNonce: bigint
    originDomain: number
    destinationDomain: number
    destinationSettler: Hex // bytes32
    fillDeadline: number
    data: Hex             // bytes
  }): Hex => {
    // Encode as tuple matching Solidity's abi.encode(OrderData)
    return encodeAbiParameters(
      parseAbiParameters([
        'bytes32 sender',
        'bytes32 recipient',
        'bytes32 inputToken',
        'bytes32 outputToken',
        'uint256 amountIn',
        'uint256 amountOut',
        'uint256 senderNonce',
        'uint32 originDomain',
        'uint32 destinationDomain',
        'bytes32 destinationSettler',
        'uint32 fillDeadline',
        'bytes data',
      ]),
      [
        params.sender,
        params.recipient,
        params.inputToken,
        params.outputToken,
        params.amountIn,
        params.amountOut,
        params.senderNonce,
        params.originDomain,
        params.destinationDomain,
        params.destinationSettler,
        params.fillDeadline,
        params.data,
      ]
    )
  }, [])

  /**
   * Open a bridge order on the origin chain
   */
  const openOrder = useCallback(async (params: OpenOrderParams): Promise<OpenOrderResult> => {
    if (!walletClient || !publicClient || !address) {
      throw new Error('Wallet not connected')
    }

    const hyperlaneAddress = EVM_CONTRACTS.hyperlane7683

    // Get a valid nonce
    const senderNonce = await findValidNonce(address)

    // Calculate fill deadline (default 1 hour from now)
    const fillDeadline = Math.floor(Date.now() / 1000) + (params.fillDeadlineSeconds ?? 3600)

    // Get destination settler (Ztarknet Hyperlane7683)
    const destinationSettler = feltToBytes32(contracts['ztarknet'].hyperlane7683)

    // Encode order data matching solver format
    const orderData = encodeOrderData({
      sender: evmAddressToBytes32(params.senderAddress),
      recipient: feltToBytes32(params.recipientAddress),
      inputToken: evmAddressToBytes32(params.inputToken),
      outputToken: feltToBytes32(params.outputToken),
      amountIn: params.amountIn,
      amountOut: params.amountOut,
      senderNonce,
      originDomain: params.originDomain,
      destinationDomain: params.destinationDomain,
      destinationSettler,
      fillDeadline,
      data: '0x' as Hex, // Empty data for basic orders
    })

    // Create the on-chain order structure
    const order: OnchainCrossChainOrder = {
      fillDeadline,
      orderDataType: ORDER_DATA_TYPE_HASH,
      orderData,
    }

    // Estimate gas for the transaction
    const gasEstimate = await publicClient.estimateContractGas({
      address: hyperlaneAddress,
      abi: Hyperlane7683Abi,
      functionName: 'open',
      args: [order],
      account: address,
    })

    // Send the transaction
    const txHash = await walletClient.writeContract({
      address: hyperlaneAddress,
      abi: Hyperlane7683Abi,
      functionName: 'open',
      args: [order],
      gas: gasEstimate + (gasEstimate / 10n), // Add 10% buffer
    })

    // Wait for confirmation and extract orderId from logs
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    })

    // Find the Open event and extract orderId
    const openLog = receipt.logs.find(
      log => log.topics[0]?.toLowerCase() === OPEN_EVENT_TOPIC.toLowerCase()
    )

    if (!openLog || !openLog.topics[1]) {
      throw new Error('Open event not found in transaction logs')
    }

    const orderId = openLog.topics[1] as Hex

    return {
      txHash,
      orderId,
    }
  }, [walletClient, publicClient, address, findValidNonce, encodeOrderData])

  /**
   * Get the status of an order
   */
  const getOrderStatus = useCallback(async (orderId: Hex): Promise<string> => {
    if (!publicClient) {
      throw new Error('Public client not available')
    }

    const status = await publicClient.readContract({
      address: EVM_CONTRACTS.hyperlane7683,
      abi: Hyperlane7683Abi,
      functionName: 'orderStatus',
      args: [orderId],
    }) as Hex

    // Convert bytes32 status to string
    if (status === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return 'UNKNOWN'
    }

    // Decode the status bytes to string
    const hexStr = status.slice(2)
    const bytes = new Uint8Array(hexStr.length / 2)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hexStr.substr(i * 2, 2), 16)
    }
    const statusStr = new TextDecoder().decode(bytes).replace(/\0/g, '').trim()

    return statusStr || 'UNKNOWN'
  }, [publicClient])

  /**
   * Quote gas payment for destination chain
   */
  const quoteGasPayment = useCallback(async (destinationDomain: number): Promise<bigint> => {
    if (!publicClient) {
      throw new Error('Public client not available')
    }

    const quote = await publicClient.readContract({
      address: EVM_CONTRACTS.hyperlane7683,
      abi: Hyperlane7683Abi,
      functionName: 'quoteGasPayment',
      args: [destinationDomain],
    }) as bigint

    return quote
  }, [publicClient])

  return {
    openOrder,
    getOrderStatus,
    quoteGasPayment,
    getLocalDomain,
    findValidNonce,
    isConnected: !!address,
    chainId,
  }
}
