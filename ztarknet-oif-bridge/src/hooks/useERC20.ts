import { useAccount, useReadContract, useSendTransaction, useContract } from '@starknet-react/core'
import ERC20Abi from '@/abis/ERC20.json'
import { uint256, type Abi, RpcProvider } from 'starknet'
import { STARKNET_RPC_URLS } from './useChainStats'
import { useState, useEffect } from 'react'

const erc20Abi = ERC20Abi as Abi

export function useERC20(tokenAddress: string, chainId?: number) {
  const { address: accountAddress } = useAccount()
  const [manualBalance, setManualBalance] = useState<any>(null)

  // Check if manual fetch is enabled for this chain
  const manualFetchEnabled = chainId && STARKNET_RPC_URLS[chainId]

  // Standard hook for normal Starknet usage (fallback/default)
  // Disable if tokenAddress is invalid (empty or '0x0') to avoid hook order issues
  const isValidAddress = tokenAddress && tokenAddress !== '' && tokenAddress !== '0x0'
  const { data: hookBalance, refetch: refetchHook } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: accountAddress ? [accountAddress] : undefined,
    watch: true,
    enabled: !!accountAddress && !manualFetchEnabled && isValidAddress, // Disable hook if address is invalid or we are using manual fetch
  })

  // Manual fetch effect
  useEffect(() => {
    let active = true
    
    const fetchBalance = async () => {
        if (!accountAddress || !tokenAddress || !manualFetchEnabled || !chainId) {
            if (active && !manualFetchEnabled) setManualBalance(null)
            return
        }

        // Use RPC explicitly
        const rpcUrl = STARKNET_RPC_URLS[chainId]
        
        if (rpcUrl) {
            try {
                const provider = new RpcProvider({ nodeUrl: rpcUrl })
                // Use callContract directly to avoid Contract class issues/linting errors
                // const selector = hash.getSelectorFromName("balanceOf")
                const res = await provider.callContract({
                    contractAddress: tokenAddress,
                    entrypoint: "balanceOf",
                    calldata: [accountAddress]
                })
                
                // Expecting u256 (2 felts)
                if (res && res.length >= 2) {
                    const low = res[0]
                    const high = res[1]
                    const bal = uint256.uint256ToBN({ low, high })
                    if (active) {
                        console.log(`Fetched Starknet balance manual (Chain ${chainId}):`, bal.toString())
                        setManualBalance(bal)
                    }
                }
            } catch (e) {
                console.error(`Failed to fetch Starknet balance manually (Chain ${chainId}):`, e)
            }
        }
    }

    fetchBalance()
    // Poll every 10s
    const interval = setInterval(fetchBalance, 10000)
    
    return () => { 
        active = false
        clearInterval(interval)
    }
  }, [accountAddress, tokenAddress, manualFetchEnabled, chainId])

  // Use manual balance if available, otherwise hook balance
  const balance = manualFetchEnabled ? manualBalance : hookBalance

  // Get contract instance for approvals
  const { contract } = useContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
  })

  // Send transaction hook
  const { sendAsync: approve } = useSendTransaction({})

  const approveTokens = async (spender: string, amount: bigint) => {
    if (!contract) throw new Error('Contract not initialized')
    const amountUint256 = uint256.bnToUint256(amount)
    return approve([{
      contractAddress: tokenAddress,
      entrypoint: 'approve',
      calldata: [spender, amountUint256.low.toString(), amountUint256.high.toString()],
    }])
  }

  return {
    balance,
    refetchBalance: refetchHook, // Note: refetchHook won't work for manual Ztarknet fetch, but that's handled by interval
    approveTokens,
  }
}
