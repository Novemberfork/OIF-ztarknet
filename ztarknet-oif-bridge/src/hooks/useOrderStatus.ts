import { useCallback, useEffect, useRef, useState } from 'react'
import { usePublicClient } from 'wagmi'
import type { Hex } from 'viem'
import { useProvider } from '@starknet-react/core'
import { EVM_CONTRACTS, contracts } from '@/config/contracts'
import Hyperlane7683Abi from '@/abis/Hyperlane7683.json'

export type OrderState = 'pending' | 'filled' | 'settled' | 'unknown' | 'error'

interface UseOrderStatusResult {
  status: OrderState
  isPolling: boolean
  error: string | null
  startPolling: (orderId: Hex) => void
  stopPolling: () => void
  checkOnce: (orderId: Hex) => Promise<OrderState>
}

// Filled event selector for Starknet
const FILLED_EVENT_SELECTOR = '0x35D8BA7F4BF26B6E2E2060E5BD28107042BE35460FBD828C9D29A2D8AF14445'

/**
 * Hook to monitor order status across chains
 * Polls both origin (EVM) and destination (Ztarknet) for status updates
 */
export function useOrderStatus(
  pollIntervalMs: number = 5000
): UseOrderStatusResult {
  const evmClient = usePublicClient()
  const { provider: starknetProvider } = useProvider()

  const [status, setStatus] = useState<OrderState>('unknown')
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const orderIdRef = useRef<Hex | null>(null)

  /**
   * Check order status on EVM origin chain
   */
  const checkEvmStatus = useCallback(async (orderId: Hex): Promise<string> => {
    if (!evmClient) return 'UNKNOWN'

    try {
      const status = await evmClient.readContract({
        address: EVM_CONTRACTS.hyperlane7683,
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
    } catch {
      return 'UNKNOWN'
    }
  }, [evmClient])

  /**
   * Check for Filled event on Ztarknet destination chain
   */
  const checkZtarknetFilled = useCallback(async (orderId: Hex): Promise<boolean> => {
    if (!starknetProvider) return false

    try {
      const ztarknetHyperlane = contracts['ztarknet'].hyperlane7683

      // Query events from the Ztarknet Hyperlane contract
      // Look for Filled event with matching orderId
      const events = await starknetProvider.getEvents({
        address: ztarknetHyperlane,
        keys: [[FILLED_EVENT_SELECTOR]],
        from_block: { block_number: 0 },
        to_block: 'latest',
        chunk_size: 100,
      })

      // Check if any event matches our orderId
      for (const event of events.events) {
        // The orderId should be in the event data
        // Format depends on how the Starknet contract emits the event
        if (event.data && event.data.length > 0) {
          // Convert orderId to felt format for comparison
          const orderIdFelt = orderId.toLowerCase()
          const eventOrderId = event.data[0]?.toLowerCase()

          if (eventOrderId && eventOrderId.includes(orderIdFelt.slice(2))) {
            return true
          }
        }
      }

      return false
    } catch (err) {
      console.error('Error checking Ztarknet filled status:', err)
      return false
    }
  }, [starknetProvider])

  /**
   * Check order status once
   */
  const checkOnce = useCallback(async (orderId: Hex): Promise<OrderState> => {
    try {
      // First check EVM status
      const evmStatus = await checkEvmStatus(orderId)

      if (evmStatus === 'SETTLED') {
        return 'settled'
      }

      if (evmStatus === 'FILLED') {
        return 'filled'
      }

      // If EVM shows OPENED, check if it's been filled on Ztarknet
      if (evmStatus === 'OPENED') {
        const isFilled = await checkZtarknetFilled(orderId)
        if (isFilled) {
          return 'filled'
        }
        return 'pending'
      }

      return 'pending'
    } catch (err) {
      console.error('Error checking order status:', err)
      return 'error'
    }
  }, [checkEvmStatus, checkZtarknetFilled])

  /**
   * Start polling for order status
   */
  const startPolling = useCallback((orderId: Hex) => {
    // Stop any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
    }

    orderIdRef.current = orderId
    setIsPolling(true)
    setError(null)
    setStatus('pending')

    const poll = async () => {
      if (!orderIdRef.current) return

      try {
        const newStatus = await checkOnce(orderIdRef.current)
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
