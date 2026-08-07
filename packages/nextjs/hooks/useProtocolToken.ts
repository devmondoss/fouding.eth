"use client";

import type { Address } from "viem";
import { useReadContract } from "wagmi";
import { protocolChain } from "@/lib/web3/config";
import { getProtocolToken, mockUsdcAbi } from "@/lib/web3/protocol";
import { useProtocolWrite } from "@/hooks/useProtocolWrite";

export function useProtocolToken(owner?: Address, spender?: Address) {
  const token = getProtocolToken();
  const abi = token.abi as typeof mockUsdcAbi;
  const balance = useReadContract({
    address: token.address,
    abi,
    chainId: protocolChain.id,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    query: { enabled: Boolean(token.address && owner) },
  });
  const allowance = useReadContract({
    address: token.address,
    abi,
    chainId: protocolChain.id,
    functionName: "allowance",
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: Boolean(token.address && owner && spender) },
  });
  const { writeAndConfirm, isConfirming } = useProtocolWrite();

  const approve = async (amount: bigint) => {
    if (!token.address || !owner || !spender) {
      throw new Error("Wallet, spender, or payment token unavailable");
    }
    return writeAndConfirm({
      account: owner,
      address: token.address,
      abi: token.abi,
      functionName: "approve",
      args: [spender, amount],
    });
  };

  const faucet = async () => {
    if (!token.faucetCapable) {
      throw new Error("El token de pago no tiene faucet");
    }
    if (!token.address || !owner) {
      throw new Error("Wallet or MockUSDC unavailable");
    }
    return writeAndConfirm({
      account: owner,
      address: token.address,
      abi: token.abi,
      functionName: "faucet",
    });
  };

  return {
    address: token.address,
    symbol: token.symbol,
    faucetCapable: token.faucetCapable,
    balance: balance.data,
    allowance: allowance.data,
    isLoading: balance.isLoading || allowance.isLoading,
    error: balance.error ?? allowance.error,
    isConfirming,
    approve,
    faucet,
  };
}
