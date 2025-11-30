export interface Uint256 {
  low: bigint
  high: bigint
}

export interface IntentData {
  destinationChain: string
  token: string
  amount: bigint
  recipient: string
  deadline: number
}

export interface Intent {
  id: string
  creator: string
  data: IntentData
  status: 'pending' | 'fulfilled' | 'expired'
  createdAt: number
}

export interface TransactionResult {
  hash: string
  status: 'pending' | 'success' | 'failed'
}
