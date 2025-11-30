import { useState, useEffect } from 'react'
import { useProvider } from '@starknet-react/core'
import type { GetTransactionReceiptResponse } from 'starknet'

export function useTransactionStatus(txHash: string | null) {
  const { provider } = useProvider()
  const [state, setState] = useState<{
    txHash: string | null
    status: 'pending' | 'success' | 'failed' | null
    receipt: GetTransactionReceiptResponse | null
  }>({
    txHash: null,
    status: null,
    receipt: null,
  })

  useEffect(() => {
    if (!txHash || !provider) {
      return
    }

    let cancelled = false

    const pollTx = async () => {
      // Set pending status when starting to poll
      setState(prev => prev.txHash === txHash ? prev : { txHash, status: 'pending', receipt: null })

      try {
        while (!cancelled) {
          const txReceipt = await provider.getTransactionReceipt(txHash)

          if (txReceipt.isSuccess()) {
            if (!cancelled) {
              setState({ txHash, status: 'success', receipt: txReceipt })
            }
            break
          } else if (txReceipt.isReverted() || txReceipt.isError()) {
            if (!cancelled) {
              setState({ txHash, status: 'failed', receipt: txReceipt })
            }
            break
          }

          await new Promise(resolve => setTimeout(resolve, 2000)) // Poll every 2s
        }
      } catch (error) {
        console.error('Error polling transaction:', error)
        if (!cancelled) {
          setState({ txHash, status: 'failed', receipt: null })
        }
      }
    }

    pollTx()

    return () => {
      cancelled = true
    }
  }, [txHash, provider])

  // Return null status if txHash changed but effect hasn't run yet
  return {
    status: state.txHash === txHash ? state.status : null,
    receipt: state.txHash === txHash ? state.receipt : null,
  }
}
