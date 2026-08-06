import type { Abi, Address } from "viem";
import deployedContracts from "@/contracts/deployedContracts";
import { protocolChain } from "@/lib/web3/config";

export type ProtocolContractName =
  | "AccessRegistry"
  | "CompanyPassportSBT"
  | "CreditRegistry"
  | "CreditVault"
  | "CreditVaultHappy"
  | "CreditVaultRecovery"
  | "MockUSDC";

type ProtocolDeployment = {
  address: Address;
  abi: Abi;
  txHash: `0x${string}`;
};

export function getProtocolContract(
  name: ProtocolContractName,
): ProtocolDeployment | undefined {
  const deployments = deployedContracts as unknown as Record<
    string,
    Record<string, ProtocolDeployment> | undefined
  >;
  return deployments[String(protocolChain.id)]?.[name];
}

export const companyPassportAbi = [
  {
    type: "function",
    name: "isVerifiedCompany",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "passportIdByWallet",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const accessRegistryAbi = [
  {
    type: "function",
    name: "isAllowedInvestor",
    stateMutability: "view",
    inputs: [{ name: "investor", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getAccessRecord",
    stateMutability: "view",
    inputs: [{ name: "investor", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "applicationHash", type: "bytes32" },
          { name: "status", type: "uint8" },
          { name: "requestedAt", type: "uint64" },
          { name: "updatedAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "requestAccess",
    stateMutability: "nonpayable",
    inputs: [{ name: "applicationHash", type: "bytes32" }],
    outputs: [],
  },
] as const;

export const creditRegistryAbi = [
  {
    type: "function",
    name: "isVaultRegistered",
    stateMutability: "view",
    inputs: [{ name: "vault", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "vaultByDealId",
    stateMutability: "view",
    inputs: [{ name: "dealId", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const creditVaultAbi = [
  {
    type: "function",
    name: "status",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "totalFunded",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "investorContribution",
    stateMutability: "view",
    inputs: [{ name: "investor", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    // (aportado, ya cobrado, cobrable ahora). El contrato hace acá la
    // misma cuenta que `claim`, así que la UI de cobro puede mostrar el
    // monto exacto en vez de arriesgar una transacción que revierta.
    type: "function",
    name: "getInvestorPosition",
    stateMutability: "view",
    inputs: [{ name: "investor", type: "address" }],
    outputs: [
      { name: "contribution", type: "uint256" },
      { name: "claimed", type: "uint256" },
      { name: "claimable", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "paymentToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "fund",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const mockUsdcAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "faucet",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;
