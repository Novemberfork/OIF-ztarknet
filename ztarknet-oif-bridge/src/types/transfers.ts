import type { Address, Hex } from 'viem'

/**
 * TransferStatus - status of a bridge transfer
 * Matches the lifecycle from oif-ui-starter
 */
export const TransferStatus = {
  // Initial states
  Idle: 'idle',
  Preparing: 'preparing',

  // Approval flow
  CheckingApproval: 'checking_approval',
  WaitingApprovalSignature: 'waiting_approval_signature',
  ApprovingToken: 'approving_token',
  ApprovalConfirming: 'approval_confirming',

  // Bridge transaction flow
  WaitingBridgeSignature: 'waiting_bridge_signature',
  SubmittingBridge: 'submitting_bridge',
  BridgeConfirming: 'bridge_confirming',

  // Fulfillment
  WaitingForFulfillment: 'waiting_for_fulfillment',
  Fulfilled: 'fulfilled',

  // Settlement (optional - handled by solver)
  WaitingForSettlement: 'waiting_for_settlement',
  Settled: 'settled',

  // Terminal states
  Completed: 'completed',
  Failed: 'failed',
  Refunded: 'refunded',
} as const

export type TransferStatus = typeof TransferStatus[keyof typeof TransferStatus]

/**
 * Human-readable status labels
 */
export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  [TransferStatus.Idle]: 'Ready',
  [TransferStatus.Preparing]: 'Preparing...',
  [TransferStatus.CheckingApproval]: 'Checking approval...',
  [TransferStatus.WaitingApprovalSignature]: 'Approve in wallet',
  [TransferStatus.ApprovingToken]: 'Approving token...',
  [TransferStatus.ApprovalConfirming]: 'Confirming approval...',
  [TransferStatus.WaitingBridgeSignature]: 'Sign bridge transaction',
  [TransferStatus.SubmittingBridge]: 'Submitting bridge...',
  [TransferStatus.BridgeConfirming]: 'Confirming on origin chain...',
  [TransferStatus.WaitingForFulfillment]: 'Waiting for solver...',
  [TransferStatus.Fulfilled]: 'Filled on destination',
  [TransferStatus.WaitingForSettlement]: 'Settling...',
  [TransferStatus.Settled]: 'Settled',
  [TransferStatus.Completed]: 'Completed',
  [TransferStatus.Failed]: 'Failed',
  [TransferStatus.Refunded]: 'Refunded',
}

/**
 * TransferContext - full context of a bridge transfer
 */
export interface TransferContext {
  // Unique identifier
  id: string

  // Status
  status: TransferStatus
  error?: string

  // Chain info
  originChain: string
  originChainId: number
  destinationChain: string
  destinationChainId: number

  // Token info
  originToken: Address
  destinationToken: string // Starknet felt
  amount: string // Human readable amount
  amountRaw: string // Raw bigint as string

  // Addresses
  sender: Address
  recipient: string // Starknet address

  // Transaction hashes
  approvalTxHash?: Hex
  originTxHash?: Hex
  fillTxHash?: string // Starknet tx hash
  settleTxHash?: Hex

  // Order info
  orderId?: Hex

  // Timestamps
  createdAt: number
  updatedAt: number
  completedAt?: number
}

/**
 * FeeQuote - estimated fees for a transfer
 */
export interface FeeQuote {
  // Gas estimation for origin chain
  gasLimit: bigint
  gasPrice: bigint
  gasCost: bigint

  // Formatted values
  gasCostFormatted: string
  gasCostUsd?: string

  // Protocol fees (if any)
  protocolFee?: bigint
  protocolFeeFormatted?: string

  // Total
  totalFee: bigint
  totalFeeFormatted: string
}

/**
 * Helper to create initial transfer context
 */
export function createTransferContext(params: {
  originChain: string
  originChainId: number
  destinationChain: string
  destinationChainId: number
  originToken: Address
  destinationToken: string
  amount: string
  amountRaw: string
  sender: Address
  recipient: string
}): TransferContext {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    status: TransferStatus.Idle,
    ...params,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/**
 * Check if transfer is in a terminal state
 */
export function isTransferComplete(status: TransferStatus): boolean {
  return (
    status === TransferStatus.Completed ||
    status === TransferStatus.Failed ||
    status === TransferStatus.Refunded
  )
}

/**
 * Check if transfer is in progress
 */
export function isTransferInProgress(status: TransferStatus): boolean {
  return !isTransferComplete(status) && status !== TransferStatus.Idle
}
