"use client";

import type { Address } from "viem";
import { useReadContract } from "wagmi";
import { protocolChain } from "@/lib/web3/config";
import {
  creditVaultAbi,
  getProtocolContract,
  type ProtocolContractName,
} from "@/lib/web3/protocol";
import { useProtocolWrite } from "@/hooks/useProtocolWrite";

export function useCreditVault(
  investor?: Address,
  name: Extract<ProtocolContractName, "CreditVault" | "CreditVaultRecovery"> =
    "CreditVault",
) {
  const deployment = getProtocolContract(name);
  const abi = deployment?.abi ?? creditVaultAbi;
  const status = useReadContract({
    address: deployment?.address,
    abi: abi as typeof creditVaultAbi,
    chainId: protocolChain.id,
    functionName: "status",
    query: { enabled: Boolean(deployment) },
  });
  const totalFunded = useReadContract({
    address: deployment?.address,
    abi: abi as typeof creditVaultAbi,
    chainId: protocolChain.id,
    functionName: "totalFunded",
    query: { enabled: Boolean(deployment) },
  });
  const contribution = useReadContract({
    address: deployment?.address,
    abi: abi as typeof creditVaultAbi,
    chainId: protocolChain.id,
    functionName: "investorContribution",
    args: investor ? [investor] : undefined,
    query: { enabled: Boolean(deployment && investor) },
  });
  const { writeAndConfirm, isConfirming } = useProtocolWrite();

  const fund = async (amount: bigint) => {
    if (!deployment || !investor) throw new Error("Wallet or vault unavailable");
    return writeAndConfirm({
      account: investor,
      address: deployment.address,
      abi: deployment.abi,
      functionName: "fund",
      args: [amount],
    });
  };

  const claim = async () => {
    if (!deployment || !investor) throw new Error("Wallet or vault unavailable");
    return writeAndConfirm({
      account: investor,
      address: deployment.address,
      abi: deployment.abi,
      functionName: "claim",
    });
  };

  return {
    address: deployment?.address,
    status: status.data,
    totalFunded: totalFunded.data,
    investorContribution: contribution.data,
    isLoading: status.isLoading || totalFunded.isLoading || contribution.isLoading,
    error: status.error ?? totalFunded.error ?? contribution.error,
    isConfirming,
    fund,
    claim,
  };
}
