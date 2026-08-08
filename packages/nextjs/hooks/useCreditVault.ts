"use client";

import type { Abi, Address } from "viem";
import { useReadContract } from "wagmi";
import { protocolChain } from "@/lib/web3/config";
import {
  creditVaultAbi,
  getProtocolContract,
  type ProtocolContractName,
} from "@/lib/web3/protocol";
import { useProtocolWrite } from "@/hooks/useProtocolWrite";

/** Vault explícito de una oportunidad — cuando existe, gana sobre `name`. */
export type VaultOverride = { address: Address; abi?: Abi } | null;

export function useCreditVault(
  investor?: Address,
  vaultOverride?: VaultOverride,
  name: Extract<ProtocolContractName, "CreditVault" | "CreditVaultRecovery"> =
    "CreditVault",
) {
  // Sin `opportunity.vaultAddress` (oportunidad aún sin vault propio) cae al
  // deployment fijo por nombre — el comportamiento de siempre para las
  // pantallas que todavía no pasan una oportunidad concreta.
  const fallback = getProtocolContract(name);
  const deployment = vaultOverride
    ? { address: vaultOverride.address, abi: vaultOverride.abi ?? creditVaultAbi }
    : fallback;
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
  // (aportado, ya cobrado, cobrable ahora) — el contrato hace la misma
  // cuenta que `claim`, así que la UI puede decir el monto exacto en vez
  // de invitar a firmar una transacción que va a revertir.
  const position = useReadContract({
    address: deployment?.address,
    abi: abi as typeof creditVaultAbi,
    chainId: protocolChain.id,
    functionName: "getInvestorPosition",
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

  // Transferencia restringida: el contrato exige que `to` esté aprobado en
  // el AccessRegistry del vault (docs/conceptos-y-cambios.md §Parte 2,
  // estilo ERC-3643). No hay contraparte ni libro de órdenes todavía — esto
  // solo mueve la posición a una wallet destino ya conocida.
  const transferPosition = async (to: Address, amount: bigint) => {
    if (!deployment || !investor) throw new Error("Wallet or vault unavailable");
    return writeAndConfirm({
      account: investor,
      address: deployment.address,
      abi: deployment.abi,
      functionName: "transferPosition",
      args: [to, amount],
    });
  };

  const [contributed, claimed, claimable] =
    (position.data as readonly [bigint, bigint, bigint] | undefined) ?? [];

  return {
    address: deployment?.address,
    status: status.data,
    totalFunded: totalFunded.data,
    investorContribution: contribution.data,
    /** Lo aportado por este inversionista, según el vault. */
    contributed,
    /** Lo que ya retiró. */
    claimed,
    /** Lo que puede retirar ahora mismo. */
    claimable,
    isLoading:
      status.isLoading ||
      totalFunded.isLoading ||
      contribution.isLoading ||
      position.isLoading,
    error:
      status.error ?? totalFunded.error ?? contribution.error ?? position.error,
    isConfirming,
    fund,
    claim,
    transferPosition,
  };
}
