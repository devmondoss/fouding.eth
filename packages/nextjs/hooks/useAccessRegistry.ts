"use client";

import type { Address, Hex } from "viem";
import { useReadContract } from "wagmi";
import { useProtocolWrite } from "@/hooks/useProtocolWrite";
import { protocolChain } from "@/lib/web3/config";
import { accessRegistryAbi, getProtocolContract } from "@/lib/web3/protocol";

export function useAccessRegistry(investor?: Address) {
  const deployment = getProtocolContract("AccessRegistry");
  const abi = deployment?.abi ?? accessRegistryAbi;
  const enabled = Boolean(deployment && investor);
  const allowed = useReadContract({
    address: deployment?.address,
    abi: abi as typeof accessRegistryAbi,
    chainId: protocolChain.id,
    functionName: "isAllowedInvestor",
    args: investor ? [investor] : undefined,
    query: { enabled },
  });
  const record = useReadContract({
    address: deployment?.address,
    abi: abi as typeof accessRegistryAbi,
    chainId: protocolChain.id,
    functionName: "getAccessRecord",
    args: investor ? [investor] : undefined,
    query: { enabled },
  });
  const { writeAndConfirm, isConfirming } = useProtocolWrite();

  return {
    address: deployment?.address,
    isAllowed: allowed.data ?? false,
    status: record.data?.status ?? 0,
    isLoading: allowed.isLoading || record.isLoading,
    isConfirming,
    error: allowed.error ?? record.error,
    requestAccess: async (applicationHash: Hex) => {
      if (!deployment || !investor) throw new Error("AccessRegistry no disponible");
      await writeAndConfirm({
        account: investor,
        address: deployment.address,
        abi: deployment.abi,
        functionName: "requestAccess",
        args: [applicationHash],
      });
      await Promise.all([allowed.refetch(), record.refetch()]);
    },
    refetch: async () => {
      await Promise.all([allowed.refetch(), record.refetch()]);
    },
  };
}
