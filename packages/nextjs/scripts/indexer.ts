/**
 * Indexer — escucha eventos del CreditVault en Arbitrum Sepolia y los
 * traduce a la forma de ActivityEvent (lib/types.ts) que el frontend ya
 * consume hoy desde datos mockeados (lib/data/store.tsx).
 *
 * Escribe a la tabla `onchain_activity` en Neon (ver scripts/migrate.ts)
 * además de imprimir cada evento en consola.
 *
 * Requiere:
 *   - CREDIT_VAULT_ADDRESS   dirección del contrato (env, sin NEXT_PUBLIC_
 *                            porque esto corre server-side, no en el browser)
 *   - DATABASE_URL           misma variable que usa el resto del backend
 *   - ARBITRUM_SEPOLIA_RPC_URL  opcional, usa el RPC público si falta
 *
 * Correr con: npm run indexer
 */
import { publicClient } from "@/lib/web3/publicClient";
import { CREDIT_VAULT_EVENTS_ABI } from "@/lib/web3/events";
import { insertOnchainActivity } from "@/lib/db/onchainActivity";
import type { ActivityEvent, ActivityKind } from "@/lib/types";

const vaultAddress = process.env.CREDIT_VAULT_ADDRESS as `0x${string}` | undefined;

if (!vaultAddress) {
  console.error(
    "Falta CREDIT_VAULT_ADDRESS — todavía no hay un CreditVault desplegado para escuchar.",
  );
  process.exit(1);
}

const EVENT_TO_KIND: Record<string, ActivityKind> = {
  Funded: "invest",
  Activated: "release",
  RepaymentRecorded: "repayment",
  Claimed: "repayment",
  DefaultDeclared: "default",
  RecoveryStarted: "recovery",
  RecoveryRecorded: "recovery",
};

/** Sella lo que salga del log en la MISMA forma que espera el frontend,
 * para que conectar Supabase después sea copiar este objeto a un insert. */
function toActivityEvent(
  eventName: string,
  args: Record<string, unknown>,
  txHash: string,
  blockTimestamp: bigint,
): Partial<ActivityEvent> {
  return {
    id: txHash,
    at: new Date(Number(blockTimestamp) * 1000).toISOString(),
    kind: EVENT_TO_KIND[eventName],
    amount: typeof args.amount === "bigint" ? args.amount : null,
    detail: `${eventName} — deal ${args.dealId ?? vaultAddress}`,
  };
}

async function main() {
  console.log(`Escuchando CreditVault en ${vaultAddress} (Arbitrum Sepolia)...`);

  publicClient.watchContractEvent({
    address: vaultAddress,
    abi: CREDIT_VAULT_EVENTS_ABI,
    onLogs: async (logs) => {
      for (const log of logs) {
        const block = await publicClient.getBlock({ blockHash: log.blockHash! });
        const args = log.args as Record<string, unknown>;
        const mapped = toActivityEvent(
          log.eventName,
          args,
          log.transactionHash!,
          block.timestamp,
        );
        console.log("[indexer]", mapped);

        await insertOnchainActivity({
          id: log.transactionHash!,
          kind: EVENT_TO_KIND[log.eventName] ?? log.eventName,
          investorAddress: typeof args.investor === "string" ? args.investor : null,
          opportunityOnchainId:
            args.dealId != null ? String(args.dealId) : (vaultAddress ?? null),
          amount: typeof args.amount === "bigint" ? args.amount : null,
          detail: mapped.detail ?? log.eventName,
          occurredAt: new Date(Number(block.timestamp) * 1000),
        });
      }
    },
  });
}

main();
