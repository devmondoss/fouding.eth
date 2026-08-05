"use client";

import type { Address } from "viem";
import { useReadContract } from "wagmi";
import { protocolChain } from "@/lib/web3/config";
import { getProtocolContract, mockUsdcAbi } from "@/lib/web3/protocol";
import { useProtocolWrite } from "@/hooks/useProtocolWrite";

export function useMockUsdc(owner?: Address, spender?: Address) {
  const deployment = getProtocolContract("MockUSDC");
  const abi = deployment?.abi ?? mockUsdcAbi;
  const balance = useReadContract({
    address: deployment?.address,
    abi: abi as typeof mockUsdcAbi,
    chainId: protocolChain.id,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    query: { enabled: Boolean(deployment && owner) },
  });
  const allowance = useReadContract({
    address: deployment?.address,
    abi: abi as typeof mockUsdcAbi,
    chainId: protocolChain.id,
    functionName: "allowance",
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: Boolean(deployment && owner && spender) },
  });
  const { writeAndConfirm, isConfirming } = useProtocolWrite();

  const approve = async (amount: bigint) => {
    if (!deployment || !owner || !spender) {
      throw new Error("Wallet, spender, or MockUSDC unavailable");
    }
    return writeAndConfirm({
      account: owner,
      address: deployment.address,
      abi: deployment.abi,
      functionName: "approve",
      args: [spender, amount],
    });
  };

  const faucet = async () => {
    if (!deployment || !owner) throw new Error("Wallet or MockUSDC unavailable");
    return writeAndConfirm({
      account: owner,
      address: deployment.address,
      abi: deployment.abi,
      functionName: "faucet",
    });
  };

  return {
    address: deployment?.address,
    balance: balance.data,
    allowance: allowance.data,
    isLoading: balance.isLoading || allowance.isLoading,
    error: balance.error ?? allowance.error,
    isConfirming,
    approve,
    faucet,
  };
}
