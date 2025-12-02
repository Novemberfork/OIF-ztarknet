import { useAccount } from '@starknet-react/core'
//import ERC20Abi from '@/abis/ERC20.json'
//import HyperlaneAbi from '@/abis/Hyperlane7683Cairo'
import { type Call } from 'starknet'
import { useMemo } from 'react'
import { useErc20Contract } from "../hooks/useERC20sn"
import { useHyperlaneContract } from './useHyperlaneCairo'
import {
  ORDER_DATA_TYPE_HASH,
  encodeOrderData,
  feltToBytes32,
  type OrderData
} from '@/utils/orderEncoding'
import { toCairoU256, hexToCairoBytes } from '@/utils/cairoEncoding'

//const erc20Abi = ERC20Abi as Abi
//const hyperlaneAbi = HyperlaneAbi as Abi;
//const erc20Abi = ERC20Abi as Abi

interface OpenOrderParams {
  // User's addresses
  senderAddress: string      // Starknet sender address
  recipientAddress: string    // Starknet recipient (full felt)

  // Token info
  inputToken: string         // Origin chain token (EVM)
  outputToken: string         // Destination chain token (Starknet felt)
  amountIn: bigint            // Amount user sends
  amountOut: bigint           // Amount user receives

  // Chain info (using Hyperlane domains)
  originDomain: number
  destinationDomain: number
  destinationSettler?: string // Destination settler address

  // Timing
  fillDeadlineSeconds?: number
}

export function useOpenOrder(hyperlaneAddress: string, order: OpenOrderParams | null) {
  const { address: accountAddress } = useAccount()
  const { erc20Contract } = useErc20Contract({
    tokenAddress: (order?.inputToken ||
      "0x0") as `0x${string}`,
  });
  const { hyperlaneContract } = useHyperlaneContract({
    address: hyperlaneAddress as `0x${string}`,
  });

  const nonce = useMemo(() => {
    // Generate a nonce based on timestamp to ensure uniqueness
    // In production, might want to fetch valid nonce from contract or track it
    return BigInt(Math.floor(Date.now() / 1000) % 1_000_000)
  }, [order])

  const orderData: OrderData | null = useMemo(() => {
    if (!order) return null;

    return {
      sender: feltToBytes32(order.senderAddress),
      recipient: feltToBytes32(order.recipientAddress),
      inputToken: feltToBytes32(order.inputToken),
      outputToken: feltToBytes32(order.outputToken),
      amountIn: order.amountIn,
      amountOut: order.amountOut,
      senderNonce: nonce,
      originDomain: order.originDomain,
      destinationDomain: order.destinationDomain,
      destinationSettler: feltToBytes32(order.destinationSettler || "0x0"),
      fillDeadline: order.fillDeadlineSeconds || Math.floor(Date.now() / 1000) + 3600, // Default 1h
      data: "0x"
    };
  }, [order, nonce]);

  const calls = useMemo(() => {
    const callsArr: Call[] = [];

    if (!accountAddress || !erc20Contract || !hyperlaneContract || !order || !orderData) {
      return callsArr;
    }

    // Prepare approve call
    const approveCall = erc20Contract.populateTransaction.approve(
      hyperlaneAddress,
      toCairoU256(order.amountIn),
    );

    const encodedOrderData = encodeOrderData(orderData)

    // Prepare open call
    const openCall = hyperlaneContract.populateTransaction.open({
      fill_deadline: orderData.fillDeadline,
      order_data_type: toCairoU256(ORDER_DATA_TYPE_HASH),
      order_data: hexToCairoBytes(encodedOrderData)
    });

    if (approveCall) {
      callsArr.push(approveCall);
    }

    if (openCall) {
      callsArr.push(openCall);
    }

    return callsArr;
  }, [
    hyperlaneAddress, order, accountAddress, erc20Contract, hyperlaneContract, orderData
  ]);

  return {
    calls,
    orderData
  };
}
