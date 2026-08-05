"use client";

import type { Address } from "viem";
import { useReadContract } from "wagmi";
import {
  companyPassportAbi,
  getProtocolContract,
} from "@/lib/web3/protocol";
import { protocolChain } from "@/lib/web3/config";

export function useCompanyPassport(wallet?: Address) {
  const deployment = getProtocolContract("CompanyPassportSBT");
  const abi = deployment?.abi ?? companyPassportAbi;
  const enabled = Boolean(deployment && wallet);
  const verified = useReadContract({
    address: deployment?.address,
    abi: abi as typeof companyPassportAbi,
    chainId: protocolChain.id,
    functionName: "isVerifiedCompany",
    args: wallet ? [wallet] : undefined,
    query: { enabled },
  });
  const passportId = useReadContract({
    address: deployment?.address,
    abi: abi as typeof companyPassportAbi,
    chainId: protocolChain.id,
    functionName: "passportIdByWallet",
    args: wallet ? [wallet] : undefined,
    query: { enabled },
  });

  return {
    address: deployment?.address,
    isVerified: verified.data ?? false,
    passportId: passportId.data,
    isLoading: verified.isLoading || passportId.isLoading,
    error: verified.error ?? passportId.error,
    refetch: async () => {
      await Promise.all([verified.refetch(), passportId.refetch()]);
    },
  };
}
