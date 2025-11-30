import { useCallback, useState } from 'react'
import {
  useAccount,
  usePublicClient,
  useWalletClient,
} from 'wagmi'
import { type Address, type Hex, erc20Abi, maxUint256 } from 'viem'

interface ApprovalState {
  isChecking: boolean
  isApproving: boolean
  needsApproval: boolean
  error: string | null
}

interface UseTokenApprovalResult extends ApprovalState {
  checkAllowance: (token: Address, spender: Address, amount: bigint) => Promise<boolean>
  approve: (token: Address, spender: Address, amount?: bigint) => Promise<Hex>
  reset: () => void
}

export function useTokenApproval(): UseTokenApprovalResult {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [state, setState] = useState<ApprovalState>({
    isChecking: false,
    isApproving: false,
    needsApproval: false,
    error: null,
  })

  /**
   * Check if approval is needed for the given amount
   */
  const checkAllowance = useCallback(async (
    token: Address,
    spender: Address,
    amount: bigint
  ): Promise<boolean> => {
    if (!publicClient || !address) {
      throw new Error('Wallet not connected')
    }

    setState(prev => ({ ...prev, isChecking: true, error: null }))

    try {
      const allowance = await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, spender],
      })

      const needsApproval = allowance < amount
      setState(prev => ({ ...prev, isChecking: false, needsApproval }))
      return needsApproval
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check allowance'
      setState(prev => ({ ...prev, isChecking: false, error: message }))
      throw error
    }
  }, [publicClient, address])

  /**
   * Approve token spending
   * @param token - Token address
   * @param spender - Spender address (e.g., Hyperlane7683 contract)
   * @param amount - Amount to approve (defaults to max uint256 for unlimited approval)
   */
  const approve = useCallback(async (
    token: Address,
    spender: Address,
    amount: bigint = maxUint256
  ): Promise<Hex> => {
    if (!walletClient || !publicClient || !address) {
      throw new Error('Wallet not connected')
    }

    setState(prev => ({ ...prev, isApproving: true, error: null }))

    try {
      // Estimate gas
      const gasEstimate = await publicClient.estimateContractGas({
        address: token,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, amount],
        account: address,
      })

      // Send approval transaction
      const txHash = await walletClient.writeContract({
        address: token,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, amount],
        gas: gasEstimate + (gasEstimate / 10n), // 10% buffer
      })

      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({
        hash: txHash,
      })

      setState(prev => ({
        ...prev,
        isApproving: false,
        needsApproval: false,
      }))

      return txHash
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Approval failed'
      setState(prev => ({ ...prev, isApproving: false, error: message }))
      throw error
    }
  }, [walletClient, publicClient, address])

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState({
      isChecking: false,
      isApproving: false,
      needsApproval: false,
      error: null,
    })
  }, [])

  return {
    ...state,
    checkAllowance,
    approve,
    reset,
  }
}

/**
 * Hook to get token balance
 */
export function useTokenBalance(token: Address | undefined) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const [balance, setBalance] = useState<bigint | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchBalance = useCallback(async () => {
    if (!publicClient || !address || !token) {
      setBalance(null)
      return
    }

    setIsLoading(true)
    try {
      const result = await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      })
      setBalance(result)
    } catch {
      setBalance(null)
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, address, token])

  return {
    balance,
    isLoading,
    refetch: fetchBalance,
  }
}

/**
 * Hook to get token decimals
 */
export function useTokenDecimals(token: Address | undefined) {
  const publicClient = usePublicClient()
  const [decimals, setDecimals] = useState<number>(18)

  const fetchDecimals = useCallback(async () => {
    if (!publicClient || !token) return

    try {
      const result = await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'decimals',
      })
      setDecimals(result)
    } catch {
      setDecimals(18) // Default to 18
    }
  }, [publicClient, token])

  return { decimals, refetch: fetchDecimals }
}
