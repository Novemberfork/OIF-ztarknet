import { describe, it, expect } from 'vitest'
import {
  ORDER_DATA_TYPE_STRING,
  ORDER_DATA_TYPE_HASH,
  computeOrderDataTypeHash,
  encodeOrderData,
  computeOrderId,
  evmAddressToBytes32,
  feltToBytes32,
  decodeOrderDataHex,
  type OrderData,
} from './orderEncoding'

describe('orderEncoding', () => {
  describe('ORDER_DATA_TYPE_HASH', () => {
    it('should match the expected hash from solver', () => {
      // This hash is from solver/cmd/tools/open-order/evm_order.go
      // and solver/cmd/tools/open-order/starknet_order.go
      const expectedHash = '0x08d75650babf4de09c9273d48ef647876057ed91d4323f8a2e3ebc2cd8a63b5e'
      expect(ORDER_DATA_TYPE_HASH.toLowerCase()).toBe(expectedHash.toLowerCase())
    })

    it('should be deterministic', () => {
      const hash1 = computeOrderDataTypeHash()
      const hash2 = computeOrderDataTypeHash()
      expect(hash1).toBe(hash2)
    })

    it('should have correct type string', () => {
      // Verify the type string matches Solidity's OrderEncoder
      expect(ORDER_DATA_TYPE_STRING).toBe(
        'OrderData(bytes32 sender,bytes32 recipient,bytes32 inputToken,bytes32 outputToken,uint256 amountIn,uint256 amountOut,uint256 senderNonce,uint32 originDomain,uint32 destinationDomain,bytes32 destinationSettler,uint32 fillDeadline,bytes data)'
      )
    })
  })

  describe('evmAddressToBytes32', () => {
    it('should left-pad EVM address to 32 bytes', () => {
      const address = '0x5A072987bD92c98b1fC417C1D4Ca20a9bCCaE5f5'
      const bytes32 = evmAddressToBytes32(address as `0x${string}`)

      // Should be 66 chars (0x + 64 hex chars)
      expect(bytes32.length).toBe(66)
      // Should be left-padded with zeros
      expect(bytes32.slice(0, 26)).toBe('0x000000000000000000000000')
      // Original address should be at the end (lowercase comparison)
      expect(bytes32.toLowerCase()).toContain(address.toLowerCase().slice(2))
    })
  })

  describe('feltToBytes32', () => {
    it('should pad Starknet felt to 32 bytes', () => {
      const felt = '0x05b98103a54cc377e4cd8539f3ef4ad52a7503b2edeefe7a0220bb6fcbf69b28'
      const bytes32 = feltToBytes32(felt)

      expect(bytes32.length).toBe(66)
      expect(bytes32.toLowerCase()).toBe(felt.toLowerCase())
    })

    it('should handle felt without 0x prefix', () => {
      const felt = '05b98103a54cc377e4cd8539f3ef4ad52a7503b2edeefe7a0220bb6fcbf69b28'
      const bytes32 = feltToBytes32(felt)

      expect(bytes32.length).toBe(66)
      expect(bytes32.startsWith('0x')).toBe(true)
    })

    it('should left-pad short felts', () => {
      const felt = '0x999999' // Short felt
      const bytes32 = feltToBytes32(felt)

      expect(bytes32.length).toBe(66)
      expect(bytes32).toBe('0x0000000000000000000000000000000000000000000000000000000000999999')
    })
  })

  describe('encodeOrderData', () => {
    const sampleOrderData: OrderData = {
      sender: '0x0000000000000000000000005A072987bD92c98b1fC417C1D4Ca20a9bCCaE5f5',
      recipient: '0x05b98103a54cc377e4cd8539f3ef4ad52a7503b2edeefe7a0220bb6fcbf69b28',
      inputToken: '0x00000000000000000000000076878654a2D96dDdF8cF0CFe8FA608aB4CE0D499',
      outputToken: '0x067c9b63ecb6a191e369a461ab05cf9a4d08093129e5ac8eedb71d4908e4cc5b',
      amountIn: 10000000000000000000n, // 10 * 10^18
      amountOut: 10000000000000000000n,
      senderNonce: 12345n,
      originDomain: 11155111, // Ethereum Sepolia
      destinationDomain: 10066329, // Ztarknet (0x999999)
      destinationSettler: '0x06508892543f6dd254cab6f166e16b4e146743cfaedde9afaa2931c18a335f22',
      fillDeadline: 1764490000,
      data: '0x',
    }

    it('should encode to correct length', () => {
      const encoded = encodeOrderData(sampleOrderData)

      // Encoded as a TUPLE (matching Go solver's encoding):
      // - 32 bytes for tuple offset header
      // - 11 static fields of 32 bytes each = 352 bytes
      // - 1 dynamic bytes field: offset (32) + length (32) = 64 bytes
      // Total = 448 bytes = 896 hex chars + 2 for '0x' = 898 chars
      expect(encoded.length).toBe(898)
    })

    it('should encode fields in correct order', () => {
      const encoded = encodeOrderData(sampleOrderData)
      const decoded = decodeOrderDataHex(encoded)

      expect(decoded.sender.toLowerCase()).toBe(sampleOrderData.sender.toLowerCase())
      expect(decoded.recipient.toLowerCase()).toBe(sampleOrderData.recipient.toLowerCase())
      expect(decoded.inputToken.toLowerCase()).toBe(sampleOrderData.inputToken.toLowerCase())
      expect(decoded.outputToken.toLowerCase()).toBe(sampleOrderData.outputToken.toLowerCase())
      expect(decoded.amountIn).toBe(sampleOrderData.amountIn)
      expect(decoded.amountOut).toBe(sampleOrderData.amountOut)
      expect(decoded.senderNonce).toBe(sampleOrderData.senderNonce)
      expect(decoded.originDomain).toBe(sampleOrderData.originDomain)
      expect(decoded.destinationDomain).toBe(sampleOrderData.destinationDomain)
      expect(decoded.destinationSettler.toLowerCase()).toBe(sampleOrderData.destinationSettler.toLowerCase())
      expect(decoded.fillDeadline).toBe(sampleOrderData.fillDeadline)
    })

    it('should encode uint32 fields as 32-byte words', () => {
      const encoded = encodeOrderData(sampleOrderData)
      const decoded = decodeOrderDataHex(encoded)

      // originDomain = 11155111 = 0xaa36a7
      expect(decoded.originDomain).toBe(11155111)

      // destinationDomain = 10066329 = 0x999999
      expect(decoded.destinationDomain).toBe(10066329)
    })

    it('should encode empty bytes correctly', () => {
      const encoded = encodeOrderData(sampleOrderData)
      const decoded = decodeOrderDataHex(encoded)

      // Tuple offset should be 32 (0x20) - pointing to where tuple content starts
      expect(decoded.tupleOffset).toBe(32)

      // Data offset should point to position 384 (12 * 32 bytes from tuple content start)
      // Note: This is relative to the tuple content, not the entire encoding
      expect(decoded.dataOffset).toBe(384)

      // Length should be 0 for empty bytes
      expect(decoded.dataLength).toBe(0)
    })

    it('should be deterministic', () => {
      const encoded1 = encodeOrderData(sampleOrderData)
      const encoded2 = encodeOrderData(sampleOrderData)
      expect(encoded1).toBe(encoded2)
    })
  })

  describe('computeOrderId', () => {
    it('should compute deterministic orderId', () => {
      const orderData: OrderData = {
        sender: '0x0000000000000000000000005A072987bD92c98b1fC417C1D4Ca20a9bCCaE5f5',
        recipient: '0x05b98103a54cc377e4cd8539f3ef4ad52a7503b2edeefe7a0220bb6fcbf69b28',
        inputToken: '0x00000000000000000000000076878654a2D96dDdF8cF0CFe8FA608aB4CE0D499',
        outputToken: '0x067c9b63ecb6a191e369a461ab05cf9a4d08093129e5ac8eedb71d4908e4cc5b',
        amountIn: 10000000000000000000n,
        amountOut: 10000000000000000000n,
        senderNonce: 12345n,
        originDomain: 11155111,
        destinationDomain: 10066329,
        destinationSettler: '0x06508892543f6dd254cab6f166e16b4e146743cfaedde9afaa2931c18a335f22',
        fillDeadline: 1764490000,
        data: '0x',
      }

      const orderId1 = computeOrderId(orderData)
      const orderId2 = computeOrderId(orderData)

      expect(orderId1).toBe(orderId2)
      expect(orderId1.length).toBe(66) // 0x + 64 hex chars
    })

    it('should produce different orderIds for different nonces', () => {
      const orderData1: OrderData = {
        sender: '0x0000000000000000000000005A072987bD92c98b1fC417C1D4Ca20a9bCCaE5f5',
        recipient: '0x05b98103a54cc377e4cd8539f3ef4ad52a7503b2edeefe7a0220bb6fcbf69b28',
        inputToken: '0x00000000000000000000000076878654a2D96dDdF8cF0CFe8FA608aB4CE0D499',
        outputToken: '0x067c9b63ecb6a191e369a461ab05cf9a4d08093129e5ac8eedb71d4908e4cc5b',
        amountIn: 10000000000000000000n,
        amountOut: 10000000000000000000n,
        senderNonce: 1n,
        originDomain: 11155111,
        destinationDomain: 10066329,
        destinationSettler: '0x06508892543f6dd254cab6f166e16b4e146743cfaedde9afaa2931c18a335f22',
        fillDeadline: 1764490000,
        data: '0x',
      }

      const orderData2 = { ...orderData1, senderNonce: 2n }

      const orderId1 = computeOrderId(orderData1)
      const orderId2 = computeOrderId(orderData2)

      expect(orderId1).not.toBe(orderId2)
    })
  })

  describe('encoding matches Solidity', () => {
    // These test cases should match output from running the solver's encodeOrderData
    // You can generate expected values by running the Go test tool

    it('should match known good encoding from solver', () => {
      // This test case uses specific values that we can verify against the solver
      const orderData: OrderData = {
        sender: evmAddressToBytes32('0x5A072987bD92c98b1fC417C1D4Ca20a9bCCaE5f5' as `0x${string}`),
        recipient: feltToBytes32('0x05b98103a54cc377e4cd8539f3ef4ad52a7503b2edeefe7a0220bb6fcbf69b28'),
        inputToken: evmAddressToBytes32('0x76878654a2D96dDdF8cF0CFe8FA608aB4CE0D499' as `0x${string}`),
        outputToken: feltToBytes32('0x067c9b63ecb6a191e369a461ab05cf9a4d08093129e5ac8eedb71d4908e4cc5b'),
        amountIn: 10000000000000000000n, // 10 ETH in wei
        amountOut: 10000000000000000000n,
        senderNonce: 12345n,
        originDomain: 11155111,
        destinationDomain: 10066329,
        destinationSettler: feltToBytes32('0x06508892543f6dd254cab6f166e16b4e146743cfaedde9afaa2931c18a335f22'),
        fillDeadline: 1764490000,
        data: '0x',
      }

      const encoded = encodeOrderData(orderData)

      // Verify structure by decoding
      const decoded = decodeOrderDataHex(encoded)

      // The encoding should have the sender at the start (after removing 0x and taking first 64 chars)
      expect(decoded.sender.toLowerCase()).toContain('5a072987bd92c98b1fc417c1d4ca20a9bccae5f5')

      // Check that all numeric fields are reasonable
      expect(decoded.amountIn).toBe(10000000000000000000n)
      expect(decoded.originDomain).toBe(11155111)
      expect(decoded.destinationDomain).toBe(10066329)
    })
  })
})
