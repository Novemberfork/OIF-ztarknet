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
} from 'viem'
import Hyperlane7683Abi from '@/abis/Hyperlane7683.json'
import {
  EVM_CONTRACTS,
  OPEN_EVENT_TOPIC,
  contracts,
} from '@/config/contracts'
import type { OnchainCrossChainOrder } from '@/types/orders'
import {
  ORDER_DATA_TYPE_HASH,
  encodeOrderData,
  evmAddressToBytes32,
  feltToBytes32,
  type OrderData,
} from '@/utils/orderEncoding'

// Log the hash for debugging
console.log('ORDER_DATA_TYPE_HASH:', ORDER_DATA_TYPE_HASH)
console.log('Expected hash (from solver): 0x08d75650babf4de09c9273d48ef647876057ed91d4323f8a2e3ebc2cd8a63b5e')

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
   * Open a bridge order on the origin chain
   */
  const openOrder = useCallback(async (params: OpenOrderParams): Promise<OpenOrderResult> => {
    if (!walletClient || !publicClient || !address) {
      throw new Error('Wallet not connected')
    }

    const hyperlaneAddress = EVM_CONTRACTS.hyperlane7683

    // Get the local domain from the contract (not hardcoded)
    // This ensures the orderData.originDomain matches what the contract expects
    const localDomain = await getLocalDomain()
    console.log('Contract localDomain:', localDomain, 'Passed originDomain:', params.originDomain)

    // Get a valid nonce
    const senderNonce = await findValidNonce(address)
    console.log('Using senderNonce:', senderNonce.toString())

    // Debug: Check token allowance
    const allowance = await publicClient.readContract({
      address: params.inputToken,
      abi: [{
        type: 'function',
        name: 'allowance',
        inputs: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' }
        ],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view'
      }],
      functionName: 'allowance',
      args: [address, hyperlaneAddress],
    })
    console.log('Token allowance:', allowance.toString(), 'Required:', params.amountIn.toString())

    // Debug: Check token balance
    const balance = await publicClient.readContract({
      address: params.inputToken,
      abi: [{
        type: 'function',
        name: 'balanceOf',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view'
      }],
      functionName: 'balanceOf',
      args: [address],
    })
    console.log('Token balance:', balance.toString(), 'Required:', params.amountIn.toString())

    if (balance < params.amountIn) {
      throw new Error(`Insufficient token balance. Have: ${balance}, Need: ${params.amountIn}`)
    }
    if (allowance < params.amountIn) {
      throw new Error(`Insufficient token allowance. Have: ${allowance}, Need: ${params.amountIn}`)
    }

    // Calculate fill deadline (default 1 hour from now)
    const fillDeadline = Math.floor(Date.now() / 1000) + (params.fillDeadlineSeconds ?? 3600)

    // Get destination settler (Ztarknet Hyperlane7683)
    const destinationSettler = feltToBytes32(contracts['ztarknet'].hyperlane7683)

    // Encode order data matching solver format
    // IMPORTANT: Use localDomain from contract, not params.originDomain
    const orderData = encodeOrderData({
      sender: evmAddressToBytes32(params.senderAddress),
      recipient: feltToBytes32(params.recipientAddress),
      inputToken: evmAddressToBytes32(params.inputToken),
      outputToken: feltToBytes32(params.outputToken),
      amountIn: params.amountIn,
      amountOut: params.amountOut,
      senderNonce,
      originDomain: localDomain, // Use contract's localDomain
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

    console.log('Order structure:', {
      fillDeadline,
      orderDataType: ORDER_DATA_TYPE_HASH,
      orderDataLength: orderData.length,
    })

    // Pre-flight: Try to resolve the order to validate structure
    try {
      const resolved = await publicClient.readContract({
        address: hyperlaneAddress,
        abi: Hyperlane7683Abi,
        functionName: 'resolve',
        args: [order],
      })
      console.log('Order resolved successfully:', resolved)
    } catch (resolveError) {
      console.error('Order resolve failed:', resolveError)
      throw new Error(`Order validation failed: ${resolveError instanceof Error ? resolveError.message : 'Unknown error'}`)
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
  }, [walletClient, publicClient, address, findValidNonce, getLocalDomain])

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
