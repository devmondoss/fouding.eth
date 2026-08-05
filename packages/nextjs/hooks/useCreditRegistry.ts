"use client";

import type { Address, Hex } from "viem";
import { useReadContract } from "wagmi";
import {
  creditRegistryAbi,
  getProtocolContract,
} from "@/lib/web3/protocol";
import { protocolChain } from "@/lib/web3/config";

export function useCreditRegistry(vault?: Address, dealId?: Hex) {
  const deployment = getProtocolContract("CreditRegistry");
  const abi = deployment?.abi ?? creditRegistryAbi;
  const registration = useReadContract({
    address: deployment?.address,
    abi: abi as typeof creditRegistryAbi,
    chainId: protocolChain.id,
    functionName: "isVaultRegistered",
    args: vault ? [vault] : undefined,
    query: { enabled: Boolean(deployment && vault) },
  });
  const dealVault = useReadContract({
    address: deployment?.address,
    abi: abi as typeof creditRegistryAbi,
    chainId: protocolChain.id,
    functionName: "vaultByDealId",
    args: dealId ? [dealId] : undefined,
    query: { enabled: Boolean(deployment && dealId) },
  });

  return {
    address: deployment?.address,
    isVaultRegistered: registration.data ?? false,
    vaultByDealId: dealVault.data,
    isLoading: registration.isLoading || dealVault.isLoading,
    error: registration.error ?? dealVault.error,
  };
}
