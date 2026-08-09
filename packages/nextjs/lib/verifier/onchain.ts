import "server-only";

import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import deployedContracts from "@/contracts/deployedContracts";
import { arbitrumNitro } from "@/utils/scaffold-stylus/supportedChains";
import type { PassportSynchronization, VerifierSubmission } from "./types";

type PassportDeployment = {
  address: Address;
  abi: readonly unknown[];
  txHash: Hex;
};

function getConfiguration() {
  const privateKey = process.env.PASSPORT_OPERATOR_PRIVATE_KEY as
    Hex | undefined;
  if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error("Falta PASSPORT_OPERATOR_PRIVATE_KEY válida");
  }
  const chain =
    process.env.PROTOCOL_CHAIN_ID === String(arbitrumSepolia.id)
      ? arbitrumSepolia
      : arbitrumNitro;
  const rpcUrl =
    chain.id === arbitrumSepolia.id
      ? process.env.ARBITRUM_SEPOLIA_RPC_URL
      : (process.env.NITRO_RPC_URL ?? "http://localhost:8547");
  if (!rpcUrl) throw new Error("Falta el RPC del protocolo");

  const contracts = deployedContracts as unknown as Record<
    string,
    Record<string, PassportDeployment> | undefined
  >;
  const passport = contracts[String(chain.id)]?.CompanyPassportSBT;
  if (!passport) {
    throw new Error(
      `CompanyPassportSBT no está desplegado en chain ${chain.id}`,
    );
  }
  return { privateKey, chain, rpcUrl, passport };
}

/**
 * Emite o actualiza el pasaporte de una EMPRESA.
 *
 * Antes solo existía la variante que recibía un expediente, porque
 * acreditar a la empresa y aprobar una operación eran el mismo acto. El
 * pasaporte es de la empresa: se emite cuando se la acredita, no cuando
 * se le aprueba un proyecto.
 */
export async function synchronizeCompanyPassport(company: {
  id: string;
  wallet: string;
  ruc: string;
  name: string;
  legalPackHash: string;
}): Promise<PassportSynchronization> {
  // Sin documento adjunto no hay hash de documento que anclar, y el
  // contrato rechaza el hash cero. Se ancla la huella de lo declarado,
  // que es exactamente lo que el verificador revisó.
  const huella = /^0x[a-fA-F0-9]{64}$/.test(company.legalPackHash)
    ? company.legalPackHash
    : keccak256(
        toBytes(
          JSON.stringify({ ruc: company.ruc, name: company.name, id: company.id }),
        ),
      );

  return synchronizeApprovedPassport({
    id: company.id,
    companyWallet: company.wallet,
    companyRuc: company.ruc,
    legalPackHash: huella,
    projectTitle: company.name,
    requestedAmount: "0",
  } as VerifierSubmission);
}

export async function synchronizeApprovedPassport(
  submission: VerifierSubmission,
): Promise<PassportSynchronization> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(submission.companyWallet)) {
    throw new Error("El expediente no contiene una wallet EVM válida");
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(submission.legalPackHash)) {
    throw new Error(
      "El expediente no contiene un legalPackHash bytes32 válido",
    );
  }
  const normalizedRuc = submission.companyRuc.replace(/\s+/g, "").toUpperCase();
  if (!normalizedRuc) {
    throw new Error("El expediente no contiene un identificador empresarial");
  }

  const { privateKey, chain, rpcUrl, passport } = getConfiguration();
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });
  const companyWallet = submission.companyWallet as Address;
  const companyId = keccak256(toBytes(`fouding:company:${normalizedRuc}`));
  const metadataHash = keccak256(
    toBytes(
      JSON.stringify({
        submissionId: submission.id,
        projectTitle: submission.projectTitle,
        requestedAmount: submission.requestedAmount,
      }),
    ),
  );
  const ttlDays = Number(process.env.PASSPORT_TTL_DAYS ?? "365");
  const riskTier = Number(process.env.PASSPORT_DEFAULT_RISK_TIER ?? "3");
  if (!Number.isInteger(ttlDays) || ttlDays <= 0) {
    throw new Error("PASSPORT_TTL_DAYS debe ser un entero positivo");
  }
  if (!Number.isInteger(riskTier) || riskTier < 1 || riskTier > 5) {
    throw new Error("PASSPORT_DEFAULT_RISK_TIER debe estar entre 1 y 5");
  }
  const block = await publicClient.getBlock();
  const expiresAt = block.timestamp + BigInt(ttlDays * 86_400);
  const tokenId = (await publicClient.readContract({
    address: passport.address,
    abi: passport.abi,
    functionName: "passportOf",
    args: [companyWallet],
  } as never)) as bigint;
  const call =
    tokenId === 0n
      ? {
          functionName: "issuePassport",
          args: [
            companyWallet,
            companyId,
            submission.legalPackHash as Hex,
            metadataHash,
            expiresAt,
            riskTier,
          ],
        }
      : {
          functionName: "updateCredential",
          args: [
            tokenId,
            submission.legalPackHash as Hex,
            metadataHash,
            expiresAt,
            riskTier,
          ],
        };
  const simulation = await publicClient.simulateContract({
    account,
    address: passport.address,
    abi: passport.abi,
    ...call,
  } as never);
  const hash = await walletClient.writeContract(simulation.request as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success")
    throw new Error(`Passport revertido: ${hash}`);
  const synchronizedTokenId = (await publicClient.readContract({
    address: passport.address,
    abi: passport.abi,
    functionName: "passportOf",
    args: [companyWallet],
  } as never)) as bigint;
  if (synchronizedTokenId === 0n) {
    throw new Error("El passport fue confirmado pero no quedó activo");
  }
  return {
    txHash: hash,
    tokenId: synchronizedTokenId.toString(),
    chainId: chain.id,
    contractAddress: passport.address,
  };
}
