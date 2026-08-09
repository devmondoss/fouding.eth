import type { Abi, Address } from "viem";
import deployedContracts from "@/contracts/deployedContracts";
import { arbitrumSepolia, protocolChain } from "@/lib/web3/config";

export type ProtocolContractName =
  | "AccessRegistry"
  | "CompanyPassportSBT"
  | "CreditRegistry"
  | "CreditVault"
  | "CreditVaultHappy"
  | "CreditVaultRecovery"
  | "MockUSDC"
  | "RepaymentRouter";

type ProtocolDeployment = {
  address: Address;
  abi: Abi;
  txHash: `0x${string}`;
};

/**
 * Token de pago canónico del protocolo por red: el MockUSDC desplegado,
 * en devnet y en Arbitrum Sepolia por igual.
 *
 * Antes en Arbitrum Sepolia se apuntaba al USDC de Circle, y eso dejaba
 * la app en un callejón: ese token no tiene faucet, así que la única
 * forma de tener saldo era conseguir USDC de testnet por fuera y
 * mandarlo a mano. Nadie que abriera el producto por primera vez podía
 * llegar a invertir. El CreditVault de esa red además está desplegado
 * SIN inicializar (`payment_token` = 0x0), así que nada ataba la app a
 * Circle: era una elección, no una restricción del contrato.
 *
 * MockUSDC es exclusivamente de desarrollo y JAMÁS debe presentarse como
 * USDC oficial (PRODUCT.md §Evidence). Por eso el símbolo es "mUSDC" en
 * las dos redes: el nombre en pantalla no miente sobre qué es.
 */
export const ARBITRUM_SEPOLIA_USDC_ADDRESS =
  "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";

export const usdcAbi = [
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
    name: "transferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export type ProtocolToken = {
  address?: Address;
  abi: Abi;
  symbol: string;
  faucetCapable: boolean;
};

export function getProtocolToken(chainId?: number): ProtocolToken {
  const id = chainId ?? protocolChain.id;
  const deployments = deployedContracts as unknown as Record<
    string,
    Record<string, ProtocolDeployment> | undefined
  >;
  const mockUsdc = deployments[String(id)]?.["MockUSDC"];

  // Sin MockUSDC desplegado en esta red no hay token de pago que valga:
  // se cae al USDC de Circle solo para que la lectura de saldo no
  // reviente, y el faucet queda apagado (lo dice `faucetCapable`).
  if (!mockUsdc && id === arbitrumSepolia.id) {
    return {
      address: ARBITRUM_SEPOLIA_USDC_ADDRESS as Address,
      abi: usdcAbi,
      symbol: "USDC",
      faucetCapable: false,
    };
  }

  return {
    address: mockUsdc?.address,
    abi: mockUsdc?.abi ?? mockUsdcAbi,
    symbol: "mUSDC",
    faucetCapable: Boolean(mockUsdc?.address),
  };
}

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
    name: "passportOf",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "credentialOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "credential",
        type: "tuple",
        components: [
          { name: "companyId", type: "bytes32" },
          { name: "legalPackHash", type: "bytes32" },
          { name: "metadataHash", type: "bytes32" },
          { name: "status", type: "uint8" },
          { name: "issuedAt", type: "uint64" },
          { name: "expiresAt", type: "uint64" },
          { name: "updatedAt", type: "uint64" },
          { name: "riskTier", type: "uint8" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "PassportIssued",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "wallet", type: "address", indexed: true },
      { name: "companyId", type: "bytes32", indexed: true },
      { name: "legalPackHash", type: "bytes32", indexed: false },
      { name: "metadataHash", type: "bytes32", indexed: false },
      { name: "expiresAt", type: "uint64", indexed: false },
      { name: "riskTier", type: "uint8", indexed: false },
    ],
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
  {
    // Transferencia restringida: el contrato exige que `to` esté aprobado
    // en el AccessRegistry del vault (docs/conceptos-y-cambios.md §Parte 2).
    type: "function",
    name: "transferPosition",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

/**
 * RepaymentRouter: entrypoint validado de repago (packages/stylus/contracts/
 * repayment-router). Se vuelve msg.sender frente a CreditVault.record_repayment,
 * así que necesita SERVICER_ROLE en CreditRegistry y el vault destino
 * aprobado — ver packages/stylus/scripts/deploy.ts.
 */
export const repaymentRouterAbi = [
  {
    type: "function",
    name: "recordRepayment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vault", type: "address" },
      { name: "repaymentId", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "principal", type: "uint256" },
      { name: "interest", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isRepaymentProcessed",
    stateMutability: "view",
    inputs: [
      { name: "vault", type: "address" },
      { name: "repaymentId", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isVaultApproved",
    stateMutability: "view",
    inputs: [{ name: "vault", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "token",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
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
