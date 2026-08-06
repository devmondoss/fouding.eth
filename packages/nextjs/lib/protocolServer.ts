import "server-only";

import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import deployedContracts from "@/contracts/deployedContracts";
import { arbitrumNitro } from "@/utils/scaffold-stylus/supportedChains";

/**
 * Firmar en cadena desde el servidor.
 *
 * Tres flujos operativos necesitan lo mismo (emitir el passport, decidir
 * el acceso de un inversionista y administrar un crédito): resolver red y
 * RPC, encontrar el contrato desplegado y firmar con una clave que nunca
 * llega al navegador. Estaba duplicado en lib/verifier/onchain.ts y volvía
 * a aparecer en cada flujo nuevo, así que vive acá una sola vez.
 *
 * Ninguna de estas claves lleva el prefijo NEXT_PUBLIC_.
 */

export type Deployment = { address: Address; abi: readonly unknown[] };

export function resolveChain() {
  const chain =
    process.env.PROTOCOL_CHAIN_ID === String(arbitrumSepolia.id)
      ? arbitrumSepolia
      : arbitrumNitro;
  const rpcUrl =
    chain.id === arbitrumSepolia.id
      ? process.env.ARBITRUM_SEPOLIA_RPC_URL
      : (process.env.NITRO_RPC_URL ?? "http://localhost:8547");
  if (!rpcUrl) throw new Error("Falta el RPC del protocolo");
  return { chain, rpcUrl };
}

export function getDeployment(name: string): Deployment {
  const { chain } = resolveChain();
  const contracts = deployedContracts as unknown as Record<
    string,
    Record<string, Deployment> | undefined
  >;
  const deployment = contracts[String(chain.id)]?.[name];
  if (!deployment) {
    throw new Error(`${name} no está desplegado en chain ${chain.id}`);
  }
  return deployment;
}

/** Cliente de solo lectura: no necesita ninguna clave. */
export function getPublicClient() {
  const { chain, rpcUrl } = resolveChain();
  return createPublicClient({ chain, transport: http(rpcUrl) });
}

/**
 * Firmante del servidor. `envNames` se prueba en orden: permite una clave
 * dedicada por rol y, si no existe, caer a la del operador general — en
 * el deploy local un mismo admin tiene todos los roles, pero en un
 * entorno serio deben ser cuentas distintas.
 */
export function getSigner(envNames: string[]) {
  const name = envNames.find((n) => {
    const value = process.env[n];
    return value && /^0x[a-fA-F0-9]{64}$/.test(value);
  });
  if (!name) {
    throw new Error(`Falta una clave válida en: ${envNames.join(" o ")}`);
  }
  const { chain, rpcUrl } = resolveChain();
  const account = privateKeyToAccount(process.env[name] as Hex);
  return {
    account,
    publicClient: createPublicClient({ chain, transport: http(rpcUrl) }),
    walletClient: createWalletClient({ account, chain, transport: http(rpcUrl) }),
  };
}

/** Simula, envía y espera el receipt. Lanza si la transacción revierte. */
export async function writeAndWait(
  signer: ReturnType<typeof getSigner>,
  call: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  },
): Promise<Hex> {
  const simulation = await signer.publicClient.simulateContract({
    account: signer.account,
    ...call,
  } as never);
  const hash = await signer.walletClient.writeContract(simulation.request as never);
  const receipt = await signer.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`La transacción revirtió: ${hash}`);
  }
  return hash;
}
