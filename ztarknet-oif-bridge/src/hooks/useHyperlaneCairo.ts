import { useContract } from "@starknet-react/core";
import hyperlaneAbi from "../abis/Hyperlane7683Cairo"

export function useHyperlaneContract({ address }: { address: `0x${string}` }) {
  const { contract: hyperlaneContract } = useContract({
    abi: hyperlaneAbi,
    address: address,
  });

  return {
    hyperlaneContract,
  };
}
