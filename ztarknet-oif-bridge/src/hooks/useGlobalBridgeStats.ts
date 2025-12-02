import { useState, useEffect } from 'react'
import { createPublicClient, http, type Chain } from 'viem'
import { mainnet, sepolia, arbitrum, arbitrumSepolia, optimismSepolia, baseSepolia } from 'viem/chains'
import { RpcProvider } from 'starknet'
import { BRIDGE_CHAINS, contracts, CHAIN_IDS } from '@/config/contracts'
import { STARKNET_RPC_URLS } from './useChainStats'

// Event selectors
// EVM Filled: 0x57f1f65270c1c2c1771948825ee86f8d23d11ab44b16eb9c213056e042d06e59
// We can't use topics directly with getLogs when using viem's public client unless we use the low-level request
// or construct the event abi item. Since the user provided the topic hash, let's trust it matches the signature
// "Filled(bytes32,bytes,bytes)" which produces that hash.
// const EVM_FILLED_TOPIC = '0x57f1f65270c1c2c1771948825ee86f8d23d11ab44b16eb9c213056e042d06e59'

// Starknet Filled: 0x272269e6cb51b0f44023dc5bc78986d2098cfa2617377f2995ca39caea9f7f0
const STARKNET_FILLED_SELECTOR = '0x272269e6cb51b0f44023dc5bc78986d2098cfa2617377f2995ca39caea9f7f0'

// Map chainId to viem Chain object
const EVM_CHAINS: Record<number, Chain> = {
  [mainnet.id]: mainnet,
  [sepolia.id]: sepolia,
  [arbitrum.id]: arbitrum,
  [arbitrumSepolia.id]: arbitrumSepolia,
  [optimismSepolia.id]: optimismSepolia,
  [baseSepolia.id]: baseSepolia,
}

export function useGlobalBridgeStats() {
  const [bridgesPerHour, setBridgesPerHour] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      // Don't set loading to true on refresh to avoid UI flickering
      if (bridgesPerHour === null) setIsLoading(true)
      
      let totalCount = 0

      try {
        const promises = BRIDGE_CHAINS.map(async (chain) => {
          try {
            const contractAddress = contracts[chain.id]?.hyperlane7683
            if (!contractAddress) return 0

            if (chain.type === 'evm') {
              const viemChain = EVM_CHAINS[chain.chainId]
              if (!viemChain) return 0

              const client = createPublicClient({
                chain: viemChain,
                transport: http()
              })

              const blockNumber = await client.getBlockNumber()
              // Blocks per hour for accurate bridges/hour calculation
              // Chain-specific block speeds:
              // - Ethereum Sepolia: ~300 blocks/hr
              // - Base Sepolia: ~1800 blocks/hr
              // - Optimism Sepolia: ~4000 blocks/hr
              // - Arbitrum Sepolia: ~30k blocks/hr (skipped due to rate limits/pagination concerns)
              let blocksPerHour = 300 // Default: Ethereum Sepolia
              
              if (chain.chainId === baseSepolia.id) {
                blocksPerHour = 1800
              } else if (chain.chainId === optimismSepolia.id) {
                blocksPerHour = 4000
              } else if (chain.chainId === arbitrumSepolia.id) {
                // Arbitrum has ~30k blocks/hr which would require extensive pagination
                // and could hit rate limits. Skipping for now.
                console.log(`Skipping Arbitrum Sepolia stats due to high block count (~30k/hr)`)
                return 0
              }

              const fromBlock = blockNumber - BigInt(blocksPerHour)
              
              console.log(`Fetching EVM stats for ${chain.name}:`, {
                fromBlock: fromBlock.toString(),
                toBlock: blockNumber.toString(),
                contract: contractAddress
              })

              const logs = await client.getLogs({
                address: contractAddress as `0x${string}`,
                event: {
                    type: 'event',
                    name: 'Filled',
                    inputs: [
                        { type: 'bytes32', name: 'orderId', indexed: false },
                        { type: 'bytes', name: 'originData', indexed: false },
                        { type: 'bytes', name: 'fillerData', indexed: false }
                    ]
                },
                fromBlock,
                toBlock: blockNumber
              })

              console.log(`Stats for ${chain.name}: ${logs.length} fills`)
              return logs.length

            } else if (chain.type === 'starknet') {
              const rpcUrl = STARKNET_RPC_URLS[chain.chainId]
              if (!rpcUrl) return 0

              const provider = new RpcProvider({ nodeUrl: rpcUrl })
              const latestBlock = await provider.getBlock('latest')
              
              // Blocks per hour for accurate bridges/hour calculation
              // Chain-specific block speeds:
              // - Ztarknet: ~100 blocks/hr
              // - Starknet Sepolia: ~2000 blocks/hr
              let blocksPerHour = 100 // Default: Ztarknet
              
              if (chain.chainId === CHAIN_IDS.starknetSepolia) {
                blocksPerHour = 2000
              }
              
              const currentBlockNum = latestBlock.block_number
              const fromBlock = currentBlockNum - blocksPerHour > 0 ? currentBlockNum - blocksPerHour : 0

              console.log(`Fetching Starknet stats for ${chain.name}:`, {
                fromBlock,
                toBlock: currentBlockNum,
                contract: contractAddress
              })

              const events = await provider.getEvents({
                address: contractAddress,
                keys: [[STARKNET_FILLED_SELECTOR]],
                from_block: { block_number: fromBlock },
                to_block: { block_number: currentBlockNum },
                chunk_size: 100 // We don't expect too many in an hour yet
              })

              console.log(`Stats for ${chain.name}: ${events.events.length} fills`)
              return events.events.length
            }
            return 0
          } catch (e) {
            console.error(`Error fetching stats for ${chain.name}:`, e)
            return 0
          }
        })

        const results = await Promise.all(promises)
        totalCount = results.reduce((acc, curr) => acc + (curr || 0), 0)
        setBridgesPerHour(totalCount)
      } catch (error) {
        console.error('Error fetching global stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 60000 * 5) // Refresh every 5 minutes to avoid rate limits
    return () => clearInterval(interval)
  }, [])

  return { bridgesPerHour, isLoading }
}

