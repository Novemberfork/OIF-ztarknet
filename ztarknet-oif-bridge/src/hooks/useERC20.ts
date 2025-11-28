import { useAccount, useReadContract, useSendTransaction, useContract } from '@starknet-react/core'
import ERC20Abi from '@/abis/ERC20.json'
import { uint256, type Abi } from 'starknet'

const erc20Abi = ERC20Abi as Abi

export function useERC20(tokenAddress: string) {
  const { address: accountAddress } = useAccount()

  // Read balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: accountAddress ? [accountAddress] : undefined,
    watch: true,
    enabled: !!accountAddress,
  })

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
    refetchBalance,
    approveTokens,
  }
}
