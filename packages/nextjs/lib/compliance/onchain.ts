import "server-only";

import { type Address, type Hex, parseAbiItem } from "viem";
import {
  getDeployment,
  getPublicClient,
  getSigner,
  writeAndWait,
} from "../protocolServer";

/**
 * Lado servidor del acceso de inversionistas (AccessRegistry).
 *
 * `approveAccess` exige COMPLIANCE_ROLE y hasta ahora solo lo llamaba el
 * script de deploy — o sea que en producción ninguna wallet nueva podía
 * quedar habilitada nunca, y `session.verified` era false para siempre.
 *
 * La clave vive solo en el servidor y la decisión se toma desde el panel
 * del verificador, que ya está protegido por API key. Un panel que
 * firmara desde el navegador exigiría que la persona de compliance
 * tuviera el rol en su propia wallet, que hoy no es el caso.
 */

const KEYS = ["COMPLIANCE_OPERATOR_PRIVATE_KEY", "PASSPORT_OPERATOR_PRIVATE_KEY"];

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

/**
 * Lista de solicitudes. El registro no enumera on-chain (solo tiene
 * `getAccessRecord(address)`), así que las direcciones salen del log de
 * `AccessRequested` y el estado ACTUAL de cada una se lee después — el
 * evento dice que pidió, no en qué quedó.
 */
export async function listAccessRequests(): Promise<AccessRequest[]> {
  const registry = getDeployment("AccessRegistry");
  const publicClient = getPublicClient();

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
  const registry = getDeployment("AccessRegistry");
  return writeAndWait(getSigner(KEYS), {
    address: registry.address,
    abi: registry.abi,
    functionName: approve ? "approveAccess" : "rejectAccess",
    args: [investor],
  });
}
