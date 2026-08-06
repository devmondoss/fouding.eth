import "server-only";

import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import deployedContracts from "@/contracts/deployedContracts";
import { arbitrumNitro } from "@/utils/scaffold-stylus/supportedChains";

/**
 * Lado servidor del acceso de inversionistas (AccessRegistry).
 *
 * `approveAccess` exige COMPLIANCE_ROLE y hasta ahora solo lo llamaba el
 * script de deploy — o sea que en producción ninguna wallet nueva podía
 * quedar habilitada nunca, y `session.verified` era false para siempre.
 *
 * Sigue el mismo patrón que lib/verifier/onchain.ts: la clave vive solo
 * en el servidor y la decisión se toma desde el panel del verificador,
 * que ya está protegido por API key. Un panel que firmara desde el
 * navegador exigiría que la persona de compliance tuviera el rol en su
 * propia wallet, que hoy no es el caso.
 */

const ACCESS_REQUESTED = parseAbiItem(
  "event AccessRequested(address indexed investor, bytes32 indexed applicationHash)",
);

export type AccessStatus = 0 | 1 | 2 | 3 | 4; // None, Pending, Approved, Rejected, Revoked

export type AccessRequest = {
  investor: Address;
  applicationHash: Hex;
  status: AccessStatus;
  requestedAt: number;
  updatedAt: number;
};

type Deployment = { address: Address; abi: readonly unknown[] };

function getConfiguration() {
  // Reutiliza la clave del passport si no hay una propia: en el deploy
  // local el mismo admin tiene los dos roles. En un entorno serio deben
  // ser cuentas distintas.
  const privateKey = (process.env.COMPLIANCE_OPERATOR_PRIVATE_KEY ??
    process.env.PASSPORT_OPERATOR_PRIVATE_KEY) as Hex | undefined;
  if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error(
      "Falta COMPLIANCE_OPERATOR_PRIVATE_KEY (o PASSPORT_OPERATOR_PRIVATE_KEY) válida",
    );
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
    Record<string, Deployment> | undefined
  >;
  const registry = contracts[String(chain.id)]?.AccessRegistry;
  if (!registry) {
    throw new Error(`AccessRegistry no está desplegado en chain ${chain.id}`);
  }
  return { privateKey, chain, rpcUrl, registry };
}

/**
 * Lista de solicitudes. El registro no enumera on-chain (solo tiene
 * `getAccessRecord(address)`), así que las direcciones salen del log de
 * `AccessRequested` y el estado ACTUAL de cada una se lee después — el
 * evento dice que pidió, no en qué quedó.
 */
export async function listAccessRequests(): Promise<AccessRequest[]> {
  const { chain, rpcUrl, registry } = getConfiguration();
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  const logs = await publicClient.getLogs({
    address: registry.address,
    event: ACCESS_REQUESTED,
    fromBlock: 0n,
    toBlock: "latest",
  });

  const seen = new Map<string, Hex>();
  for (const log of logs) {
    const investor = log.args.investor as Address | undefined;
    if (investor) seen.set(investor.toLowerCase(), log.args.applicationHash as Hex);
  }

  const records = await Promise.all(
    [...seen.entries()].map(async ([investor, applicationHash]) => {
      const record = (await publicClient.readContract({
        address: registry.address,
        abi: registry.abi,
        functionName: "getAccessRecord",
        args: [investor as Address],
      } as never)) as {
        applicationHash: Hex;
        status: number;
        requestedAt: bigint;
        updatedAt: bigint;
      };
      return {
        investor: investor as Address,
        applicationHash,
        status: record.status as AccessStatus,
        requestedAt: Number(record.requestedAt),
        updatedAt: Number(record.updatedAt),
      };
    }),
  );

  // Pendientes primero: son las que esperan una decisión.
  return records.sort((a, b) => {
    if (a.status === 1 && b.status !== 1) return -1;
    if (b.status === 1 && a.status !== 1) return 1;
    return b.requestedAt - a.requestedAt;
  });
}

export async function decideAccess(
  investor: Address,
  approve: boolean,
): Promise<Hex> {
  const { privateKey, chain, rpcUrl, registry } = getConfiguration();
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  const simulation = await publicClient.simulateContract({
    account,
    address: registry.address,
    abi: registry.abi,
    functionName: approve ? "approveAccess" : "rejectAccess",
    args: [investor],
  } as never);
  const hash = await walletClient.writeContract(simulation.request as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`La decisión de acceso revirtió: ${hash}`);
  }
  return hash;
}
