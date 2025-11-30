import {
  encodeAbiParameters,
  keccak256,
  toHex,
  padHex,
  type Hex,
  type Address,
} from 'viem'

/**
 * Order data type string - must match Solidity's OrderEncoder exactly
 */
export const ORDER_DATA_TYPE_STRING =
  'OrderData(bytes32 sender,bytes32 recipient,bytes32 inputToken,bytes32 outputToken,uint256 amountIn,uint256 amountOut,uint256 senderNonce,uint32 originDomain,uint32 destinationDomain,bytes32 destinationSettler,uint32 fillDeadline,bytes data)'

/**
 * Compute the ORDER_DATA_TYPE_HASH
 * Must match: keccak256(abi.encodePacked(ORDER_DATA_TYPE)) in Solidity
 */
export function computeOrderDataTypeHash(): Hex {
  return keccak256(toHex(ORDER_DATA_TYPE_STRING))
}

// Pre-computed hash for efficiency
export const ORDER_DATA_TYPE_HASH = computeOrderDataTypeHash()

/**
 * OrderData structure matching Solidity's OrderData struct
 */
export interface OrderData {
  sender: Hex           // bytes32
  recipient: Hex        // bytes32
  inputToken: Hex       // bytes32
  outputToken: Hex      // bytes32
  amountIn: bigint      // uint256
  amountOut: bigint     // uint256
  senderNonce: bigint   // uint256
  originDomain: number  // uint32
  destinationDomain: number // uint32
  destinationSettler: Hex // bytes32
  fillDeadline: number  // uint32
  data: Hex             // bytes
}

/**
 * Convert an EVM address (20 bytes) to bytes32 (left-padded with zeros)
 */
export function evmAddressToBytes32(address: Address): Hex {
  // Remove 0x, pad to 64 hex chars (32 bytes), add 0x back
  return padHex(address, { size: 32 })
}

/**
 * Convert a Starknet felt (hex string) to bytes32
 * Starknet felts are already 32 bytes, just ensure proper padding
 */
export function feltToBytes32(felt: string): Hex {
  const cleaned = felt.startsWith('0x') ? felt.slice(2) : felt
  const padded = cleaned.padStart(64, '0')
  return `0x${padded}` as Hex
}

/**
 * Encode OrderData to bytes matching Solidity's abi.encode(OrderData)
 *
 * IMPORTANT: Must encode as a TUPLE, not individual parameters!
 * The Go solver uses abi.NewType("tuple", ...) and args.Pack(struct),
 * which produces different encoding than individual parameters when
 * the struct contains dynamic types (like bytes).
 *
 * This must produce identical output to:
 * ```solidity
 * function encode(OrderData memory order) internal pure returns (bytes memory) {
 *     return abi.encode(order);
 * }
 * ```
 */
export function encodeOrderData(orderData: OrderData): Hex {
  // Encode as a TUPLE type (matching Go's abi.NewType("tuple", ...))
  // This is critical - encoding individual parameters produces different output
  // when the struct contains dynamic types (bytes)
  const orderDataTupleType = {
    type: 'tuple' as const,
    components: [
      { type: 'bytes32' as const, name: 'sender' },
      { type: 'bytes32' as const, name: 'recipient' },
      { type: 'bytes32' as const, name: 'inputToken' },
      { type: 'bytes32' as const, name: 'outputToken' },
      { type: 'uint256' as const, name: 'amountIn' },
      { type: 'uint256' as const, name: 'amountOut' },
      { type: 'uint256' as const, name: 'senderNonce' },
      { type: 'uint32' as const, name: 'originDomain' },
      { type: 'uint32' as const, name: 'destinationDomain' },
      { type: 'bytes32' as const, name: 'destinationSettler' },
      { type: 'uint32' as const, name: 'fillDeadline' },
      { type: 'bytes' as const, name: 'data' },
    ],
  }

  const orderDataValue = {
    sender: orderData.sender,
    recipient: orderData.recipient,
    inputToken: orderData.inputToken,
    outputToken: orderData.outputToken,
    amountIn: orderData.amountIn,
    amountOut: orderData.amountOut,
    senderNonce: orderData.senderNonce,
    originDomain: orderData.originDomain,
    destinationDomain: orderData.destinationDomain,
    destinationSettler: orderData.destinationSettler,
    fillDeadline: orderData.fillDeadline,
    data: orderData.data,
  }

  const encoded = encodeAbiParameters([orderDataTupleType], [orderDataValue])

  return encoded
}

/**
 * Compute the orderId from OrderData
 * Must match: keccak256(abi.encode(orderData)) in Solidity
 */
export function computeOrderId(orderData: OrderData): Hex {
  const encoded = encodeOrderData(orderData)
  return keccak256(encoded)
}

/**
 * OnchainCrossChainOrder structure
 */
export interface OnchainCrossChainOrder {
  fillDeadline: number    // uint32
  orderDataType: Hex      // bytes32
  orderData: Hex          // bytes
}

/**
 * Create an OnchainCrossChainOrder from OrderData
 */
export function createOnchainOrder(orderData: OrderData): OnchainCrossChainOrder {
  return {
    fillDeadline: orderData.fillDeadline,
    orderDataType: ORDER_DATA_TYPE_HASH,
    orderData: encodeOrderData(orderData),
  }
}

/**
 * Decode encoded order data back to OrderData (for testing)
 * Note: This is a simplified decoder for testing purposes
 *
 * The encoding includes a 32-byte tuple offset header at the start,
 * so we skip the first 32 bytes (64 hex chars) to get to the actual data
 */
export function decodeOrderDataHex(encoded: Hex): {
  tupleOffset: number
  sender: Hex
  recipient: Hex
  inputToken: Hex
  outputToken: Hex
  amountIn: bigint
  amountOut: bigint
  senderNonce: bigint
  originDomain: number
  destinationDomain: number
  destinationSettler: Hex
  fillDeadline: number
  dataOffset: number
  dataLength: number
} {
  // Remove 0x prefix
  const hex = encoded.slice(2)

  // Each field is 32 bytes = 64 hex chars
  const getWord = (index: number): string => hex.slice(index * 64, (index + 1) * 64)

  // First word is the tuple offset (should be 0x20 = 32, pointing to start of tuple content)
  const tupleOffset = Number(BigInt(`0x${getWord(0)}`))

  // Remaining words are the struct fields (offset by 1 due to tuple header)
  return {
    tupleOffset,
    sender: `0x${getWord(1)}` as Hex,
    recipient: `0x${getWord(2)}` as Hex,
    inputToken: `0x${getWord(3)}` as Hex,
    outputToken: `0x${getWord(4)}` as Hex,
    amountIn: BigInt(`0x${getWord(5)}`),
    amountOut: BigInt(`0x${getWord(6)}`),
    senderNonce: BigInt(`0x${getWord(7)}`),
    originDomain: Number(BigInt(`0x${getWord(8)}`)),
    destinationDomain: Number(BigInt(`0x${getWord(9)}`)),
    destinationSettler: `0x${getWord(10)}` as Hex,
    fillDeadline: Number(BigInt(`0x${getWord(11)}`)),
    dataOffset: Number(BigInt(`0x${getWord(12)}`)),
    dataLength: Number(BigInt(`0x${getWord(13)}`)),
  }
}
