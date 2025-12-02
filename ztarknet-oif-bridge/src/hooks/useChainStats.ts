import { useEffect, useState, useCallback, useRef } from 'react'
import { usePublicClient } from 'wagmi'
import { formatGwei } from 'viem'
import { RpcProvider } from 'starknet'
import { CHAIN_IDS } from '@/config/contracts'

export interface ChainStats {
  blockNumber: number | null
  gasPrice: string | null
  latency: number | null
  tps: number | null
  isLoading: boolean
  error: string | null
}

const initialStats: ChainStats = {
  blockNumber: null,
  gasPrice: null,
  latency: null,
  tps: null,
  isLoading: true,
  error: null,
}

const STARKNET_RPC_URLS: Record<number, string> = {
  [CHAIN_IDS.starknetSepolia]: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_9/9rvOFV5vjhFiCpd5znbZK',
  [CHAIN_IDS.ztarknet]: 'https://ztarknet-madara.d.karnot.xyz',
}

export function useEvmChainStats(chainId: number | undefined, enabled: boolean = true) {
  const [stats, setStats] = useState<ChainStats>(initialStats)
  const publicClient = usePublicClient({ chainId })
  const retryCount = useRef(0)

  const fetchStats = useCallback(async () => {
    if (!publicClient || !enabled || !chainId) {
      setStats(prev => ({ ...prev, isLoading: false }))
      return
    }

    const startTime = performance.now()

    try {
      const [blockNumber, gasPrice] = await Promise.all([
        publicClient.getBlockNumber(),
        publicClient.getGasPrice(),
      ])

      const latency = Math.round(performance.now() - startTime)
      retryCount.current = 0 // Reset retry count on success

      setStats({
        blockNumber: Number(blockNumber),
        gasPrice: formatGwei(gasPrice),
        latency,
        tps: null, // Would need historical data to calculate
        isLoading: false,
        error: null,
      })
    } catch {
      retryCount.current += 1
      // Only set error state, don't log to console
      setStats(prev => ({
        ...prev,
        isLoading: false,
        error: 'RPC unavailable',
      }))
    }
  }, [publicClient, enabled, chainId])

  useEffect(() => {
    if (!enabled || !chainId) {
      setStats(initialStats)
      return
    }

    // Reset stats when chain changes
    setStats(initialStats)
    retryCount.current = 0

    fetchStats()
    const interval = setInterval(fetchStats, 12000) // Refresh every 12s (block time)

    return () => clearInterval(interval)
  }, [fetchStats, enabled, chainId])

  return stats
}

export function useStarknetChainStats(chainId: number | undefined, enabled: boolean = true) {
  const [stats, setStats] = useState<ChainStats>(initialStats)
  const retryCount = useRef(0)
  const hasError = useRef(false)

  const fetchStats = useCallback(async () => {
    if (!enabled || !chainId) {
      setStats(prev => ({ ...prev, isLoading: false }))
      return
    }

    // Get specific provider for the requested chain
    const rpcUrl = STARKNET_RPC_URLS[chainId]
    if (!rpcUrl) {
      // Fallback or error if unknown chain
      setStats(prev => ({ ...prev, isLoading: false, error: 'Unknown Starknet Chain' }))
      return
    }

    const provider = new RpcProvider({ nodeUrl: rpcUrl })

    // If we've had CORS/network errors, stop retrying to avoid console spam
    if (hasError.current && retryCount.current > 2) {
      return
    }

    const startTime = performance.now()

    try {
      const block = await provider.getBlock('latest')
      const latency = Math.round(performance.now() - startTime)
      retryCount.current = 0
      hasError.current = false

      setStats({
        blockNumber: block.block_number ?? null,
        gasPrice: null, // Starknet gas is more complex
        latency,
        tps: block.transactions?.length ?? null,
        isLoading: false,
        error: null,
      })
    } catch (e) {
      console.error('Starknet stats error:', e)
      retryCount.current += 1
      hasError.current = true
      // Silently handle CORS and network errors
      setStats(prev => ({
        ...prev,
        isLoading: false,
        error: 'RPC unavailable',
      }))
    }
  }, [enabled, chainId])

  useEffect(() => {
    if (!enabled || !chainId) {
      setStats(initialStats)
      return
    }

    // Reset stats and error tracking when chain changes
    setStats(initialStats)
    retryCount.current = 0
    hasError.current = false

    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30s

    return () => clearInterval(interval)
  }, [fetchStats, enabled, chainId])

  return stats
}
