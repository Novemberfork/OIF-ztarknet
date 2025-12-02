import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useConfig } from 'wagmi'
import { getPublicClient } from '@wagmi/core'
import type { Hex } from 'viem'
import { RpcProvider } from 'starknet'
import { EVM_CONTRACTS, contracts, getHyperlane7683Address } from '@/config/contracts'
import { chains } from '@/config/chains'
import Hyperlane7683Abi from '@/abis/Hyperlane7683.json'

export type OrderState = 'pending' | 'filled' | 'settled' | 'unknown' | 'error'

interface UseOrderStatusResult {
  status: OrderState
  isPolling: boolean
  error: string | null
  startPolling: (orderId: Hex, destinationChainId?: number) => void
  stopPolling: () => void
  checkOnce: (orderId: Hex, destinationChainId?: number) => Promise<OrderState>
}

// Filled event selector for Starknet
const FILLED_EVENT_SELECTOR = '0x35D8BA7F4BF26B6E2E2060E5BD28107042BE35460FBD828C9D29A2D8AF14445'

/**
 * Hook to monitor order status across chains
 * Polls destination for status updates
 */
export function useOrderStatus(
  pollIntervalMs: number = 5000
): UseOrderStatusResult {
  const config = useConfig()
  
  const [status, setStatus] = useState<OrderState>('unknown')
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const orderIdRef = useRef<Hex | null>(null)
  const destChainIdRef = useRef<number | undefined>(undefined)

  /**
   * Check order status on EVM chain
   */
  const checkEvmStatus = useCallback(async (orderId: Hex, chainId: number): Promise<string> => {
    try {
      const client = getPublicClient(config, { chainId })
      if (!client) return 'UNKNOWN'
      
      const hyperlaneAddress = getHyperlane7683Address(chainId)
      if (!hyperlaneAddress) return 'UNKNOWN'

      const status = await client.readContract({
        address: hyperlaneAddress,
        abi: Hyperlane7683Abi,
        functionName: 'orderStatus',
        args: [orderId],
      }) as Hex

      // Decode bytes32 to string
      if (status === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        return 'UNKNOWN'
      }

      const hexStr = status.slice(2)
      const bytes = new Uint8Array(hexStr.length / 2)
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hexStr.substr(i * 2, 2), 16)
      }
      const statusStr = new TextDecoder().decode(bytes).replace(/\0/g, '').trim()

      return statusStr || 'UNKNOWN'
    } catch (err) {
      console.error(`Error checking EVM status on chain ${chainId}:`, err)
      return 'UNKNOWN'
    }
  }, [config])

  /**
   * Check for Filled status on Starknet chain
   */
  const checkStarknetStatus = useCallback(async (orderId: Hex, chainId: number): Promise<OrderState> => {
    try {
      let rpcUrl = '';
      let contractAddress = '';

      if (chainId === Number(chains.zstarknet.chainId)) {
          rpcUrl = chains.zstarknet.rpcUrl;
          contractAddress = contracts['ztarknet'].hyperlane7683;
      } else if (chainId === Number(chains.starknetSepolia.chainId)) {
          rpcUrl = chains.starknetSepolia.rpcUrl;
          contractAddress = contracts['starknet-sepolia'].hyperlane7683;
      } else {
          return 'unknown';
      }

      const provider = new RpcProvider({ nodeUrl: rpcUrl });

      // First try to call order_status if available
      // Note: We need to convert hex orderId to u256 for Cairo call
      // But checking events is often more reliable if view functions are restricted or fail
      
      // Query events from the Starknet Hyperlane contract
      // Look for Filled event with matching orderId
      const events = await provider.getEvents({
        address: contractAddress,
        keys: [[FILLED_EVENT_SELECTOR]],
        from_block: { block_number: 0 }, // Ideally we'd optimize this to recent blocks
        to_block: 'latest',
        chunk_size: 100,
      })

      // Check if any event matches our orderId
      for (const event of events.events) {
        if (event.data && event.data.length > 0) {
          const orderIdFelt = orderId.toLowerCase()
          const eventOrderId = event.data[0]?.toLowerCase()

          // Simple containment check for felt/hex match
          if (eventOrderId && (eventOrderId === orderIdFelt || eventOrderId.includes(orderIdFelt.slice(2)))) {
            return 'filled'
          }
        }
      }

      return 'pending'
    } catch (err) {
      console.error(`Error checking Starknet status on chain ${chainId}:`, err)
      return 'error'
    }
  }, [])

  /**
   * Check order status once
   */
  const checkOnce = useCallback(async (orderId: Hex, destinationChainId?: number): Promise<OrderState> => {
    try {
      // Determine if destination is EVM or Starknet
      const destChainId = destinationChainId || destChainIdRef.current;
      
      if (!destChainId) {
          // Fallback logic if no destination provided (legacy)
          // Default to checking if it's Ztarknet (Starknet) or assuming EVM connected chain
          // For safety, let's just try to check Ztarknet as per old logic if no chain provided
          return await checkStarknetStatus(orderId, Number(chains.zstarknet.chainId));
      }

      // Check if Starknet
      if (destChainId === Number(chains.zstarknet.chainId) || destChainId === Number(chains.starknetSepolia.chainId)) {
          return await checkStarknetStatus(orderId, destChainId);
      }

      // Assume EVM otherwise
      const statusStr = await checkEvmStatus(orderId, destChainId);
      if (statusStr === 'FILLED') return 'filled';
      if (statusStr === 'SETTLED') return 'settled';
      
      return 'pending';

    } catch (err) {
      console.error('Error checking order status:', err)
      return 'error'
    }
  }, [checkEvmStatus, checkStarknetStatus])

  /**
   * Start polling for order status
   */
  const startPolling = useCallback((orderId: Hex, destinationChainId?: number) => {
    // Stop any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
    }

    orderIdRef.current = orderId
    destChainIdRef.current = destinationChainId
    setIsPolling(true)
    setError(null)
    setStatus('pending')

    const poll = async () => {
      if (!orderIdRef.current) return

      try {
        const newStatus = await checkOnce(orderIdRef.current, destChainIdRef.current)
        setStatus(newStatus)

        // Stop polling if we've reached a terminal state
        if (newStatus === 'filled' || newStatus === 'settled' || newStatus === 'error') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          setIsPolling(false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Polling failed')
        setStatus('error')
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        setIsPolling(false)
      }
    }

    // Initial check
    poll()

    // Set up interval
    pollingRef.current = setInterval(poll, pollIntervalMs)
  }, [checkOnce, pollIntervalMs])

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    orderIdRef.current = null
    destChainIdRef.current = undefined
    setIsPolling(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  return {
    status,
    isPolling,
    error,
    startPolling,
    stopPolling,
    checkOnce,
  }
}

/**
 * Simplified hook that just returns the current status
 * Useful for displaying status without polling
 */
export function useOrderStatusOnce(orderId: Hex | null) {
  const { checkOnce } = useOrderStatus()
  const [status, setStatus] = useState<OrderState>('unknown')
  const [isLoading, setIsLoading] = useState(false)

  const check = useCallback(async () => {
    if (!orderId) return

    setIsLoading(true)
    try {
      const result = await checkOnce(orderId)
      setStatus(result)
    } finally {
      setIsLoading(false)
    }
  }, [orderId, checkOnce])

  return { status, isLoading, refetch: check }
}
