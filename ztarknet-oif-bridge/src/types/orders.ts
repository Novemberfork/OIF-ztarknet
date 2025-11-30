import type { Address, Hex } from 'viem'

/**
 * Output represents a token transfer in an order
 * Matches solver's types.Output
 */
export interface Output {
  token: Hex // bytes32 - token address padded to 32 bytes
  amount: bigint
  recipient: Hex // bytes32 - recipient address padded to 32 bytes
  chainId: bigint
}

/**
 * FillInstruction contains data for filling on a destination chain
 * Matches solver's types.FillInstruction
 */
export interface FillInstruction {
  destinationChainId: bigint
  destinationSettler: Hex // bytes32
  originData: Hex // bytes
}

/**
 * OnchainCrossChainOrder is the order structure submitted to the contract
 */
export interface OnchainCrossChainOrder {
  fillDeadline: number // uint32
  orderDataType: Hex // bytes32
  orderData: Hex // bytes - encoded order data
}

/**
 * ResolvedCrossChainOrder is the fully resolved order after opening
 * Matches solver's types.ResolvedCrossChainOrder
 */
export interface ResolvedCrossChainOrder {
  user: Address
  originChainId: bigint
  openDeadline: number // uint32
  fillDeadline: number // uint32
  orderId: Hex // bytes32
  maxSpent: Output[]
  minReceived: Output[]
  fillInstructions: FillInstruction[]
}

/**
 * OrderStatus represents the status of an order on-chain
 */
export type OrderStatus = 'UNKNOWN' | 'OPENED' | 'FILLED' | 'SETTLED' | 'REFUNDED'

/**
 * OrderStatusBytes32 maps status strings to their bytes32 values
 */
export const ORDER_STATUS_BYTES32: Record<OrderStatus, Hex> = {
  UNKNOWN: '0x0000000000000000000000000000000000000000000000000000000000000000',
  OPENED: '0x4f50454e45440000000000000000000000000000000000000000000000000000', // "OPENED" padded
  FILLED: '0x46494c4c45440000000000000000000000000000000000000000000000000000', // "FILLED" padded
  SETTLED: '0x534554544c454400000000000000000000000000000000000000000000000000', // "SETTLED" padded
  REFUNDED: '0x524546554e444544000000000000000000000000000000000000000000000000', // "REFUNDED" padded
}

/**
 * BridgeOrderParams - parameters for creating a bridge order
 */
export interface BridgeOrderParams {
  // Source chain info
  originChainId: number
  originToken: Address
  originAmount: bigint

  // Destination chain info
  destinationChainId: number
  destinationToken: Hex // bytes32 for Starknet addresses
  destinationAmount: bigint
  recipient: Hex // bytes32 for Starknet addresses

  // Timing
  fillDeadlineSeconds?: number // defaults to 1 hour
}

/**
 * Helper to convert an EVM address to bytes32
 */
export function addressToBytes32(address: Address): Hex {
  return `0x000000000000000000000000${address.slice(2)}` as Hex
}

/**
 * Helper to convert a Starknet felt to bytes32
 * Starknet addresses are already 32 bytes but may need padding
 */
export function feltToBytes32(felt: string): Hex {
  const cleaned = felt.startsWith('0x') ? felt.slice(2) : felt
  return `0x${cleaned.padStart(64, '0')}` as Hex
}

/**
 * Helper to extract EVM address from bytes32
 */
export function bytes32ToAddress(bytes32: Hex): Address {
  return `0x${bytes32.slice(-40)}` as Address
}
