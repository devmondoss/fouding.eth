"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BaseError,
  ContractFunctionRevertedError,
  parseAbiItem,
  type Address,
  type Hex,
} from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { companyPassportAbi, getProtocolContract } from "@/lib/web3/protocol";
import { protocolChain } from "@/lib/web3/config";

export type CompanyPassportCredential = {
  companyId: Hex;
  legalPackHash: Hex;
  metadataHash: Hex;
  status: number;
  issuedAt: bigint;
  expiresAt: bigint;
  updatedAt: bigint;
  riskTier: number;
};

export type CompanyPassportStatus =
  | "loading"
  | "wrong-network"
  | "no-passport"
  | "active"
  | "suspended"
  | "revoked"
  | "expired"
  | "rpc-error";

const passportIssuedEvent = parseAbiItem(
  "event PassportIssued(uint256 indexed tokenId, address indexed wallet, bytes32 indexed companyId, bytes32 legalPackHash, bytes32 metadataHash, uint64 expiresAt, uint8 riskTier)",
);

function isContractRevert(error: unknown): boolean {
  return (
    error instanceof BaseError &&
    Boolean(
      error.walk((cause) => cause instanceof ContractFunctionRevertedError),
    )
  );
}

function credentialStatus(status: number): CompanyPassportStatus {
  if (status === 0) return "active";
  if (status === 1) return "suspended";
  if (status === 2) return "revoked";
  return "expired";
}

export function useCompanyPassport(wallet?: Address) {
  const deployment = getProtocolContract("CompanyPassportSBT");
  const abi = deployment?.abi ?? companyPassportAbi;
  const publicClient = usePublicClient({ chainId: protocolChain.id });
  const { chainId: connectedChainId, isConnected } = useAccount();
  const isWrongNetwork = Boolean(
    isConnected && connectedChainId && connectedChainId !== protocolChain.id,
  );

  const query = useQuery({
    queryKey: [
      "company-passport",
      protocolChain.id,
      deployment?.address,
      deployment?.txHash,
      wallet,
    ],
    enabled: Boolean(wallet && deployment && publicClient && !isWrongNetwork),
    retry: 1,
    queryFn: async () => {
      if (!wallet || !deployment || !publicClient) {
        throw new Error("Company Passport no configurado");
      }

      let activeTokenId = 0n;
      try {
        activeTokenId = (await publicClient.readContract({
          address: deployment.address,
          abi,
          functionName: "passportOf",
          args: [wallet],
        })) as bigint;
      } catch (error) {
        if (!isContractRevert(error)) throw error;
      }

      const deploymentReceipt = await publicClient.getTransactionReceipt({
        hash: deployment.txHash,
      });
      const issuedLogs = await publicClient.getLogs({
        address: deployment.address,
        event: passportIssuedEvent,
        args: { wallet },
        fromBlock: deploymentReceipt.blockNumber,
        toBlock: "latest",
      });
      const latestIssued = issuedLogs.at(-1);
      const historicalTokenId = latestIssued?.args.tokenId;
      const tokenId = activeTokenId || historicalTokenId || 0n;

      if (tokenId === 0n) {
        return { tokenId: null, credential: null, issuanceTxHash: null };
      }

      let credential: CompanyPassportCredential;
      try {
        credential = (await publicClient.readContract({
          address: deployment.address,
          abi,
          functionName: "credentialOf",
          args: [tokenId],
        })) as CompanyPassportCredential;
      } catch (error) {
        // rotateWallet quema el token anterior. Su PassportIssued histórico
        // sigue existiendo, pero credentialOf debe revertir porque ya no hay
        // ERC-721 propietario: para esa wallet el resultado canónico es vacío.
        if (isContractRevert(error)) {
          return { tokenId: null, credential: null, issuanceTxHash: null };
        }
        throw error;
      }

      const issuanceTxHash =
        issuedLogs.find((log) => log.args.tokenId === tokenId)
          ?.transactionHash ?? null;

      return { tokenId, credential, issuanceTxHash };
    },
  });

  let status: CompanyPassportStatus;
  if (isWrongNetwork) status = "wrong-network";
  else if (!wallet) status = "no-passport";
  else if (!deployment || !publicClient || query.isError) status = "rpc-error";
  else if (query.isPending) status = "loading";
  else if (!query.data?.tokenId || !query.data.credential)
    status = "no-passport";
  else status = credentialStatus(query.data.credential.status);

  return {
    status,
    isLoading: status === "loading",
    isWrongNetwork,
    tokenId: query.data?.tokenId ?? null,
    credential: query.data?.credential ?? null,
    contractAddress: deployment?.address,
    chainId: protocolChain.id,
    issuanceTxHash: query.data?.issuanceTxHash ?? null,
    error:
      status === "rpc-error"
        ? (query.error ?? new Error("Company Passport no configurado"))
        : null,
    refetch: query.refetch,
  };
}
