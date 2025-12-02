import { useContract } from "@starknet-react/core";
import erc20ABI from "../abis/ERC20sn.ts";

export function useErc20Contract({ tokenAddress }: { tokenAddress: `0x${string}` }) {
  const { contract: erc20Contract } = useContract({
    abi: erc20ABI,
    address: tokenAddress,
  });

  return {
    erc20Contract,
  };
} 
