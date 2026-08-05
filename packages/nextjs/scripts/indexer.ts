/**
 * Indexer — escucha eventos del CreditVault en Arbitrum Sepolia y los
 * traduce a la forma de ActivityEvent (lib/types.ts) que el frontend ya
 * consume hoy desde datos mockeados (lib/data/store.tsx).
 *
 * ESTADO: sin destino real todavía — Supabase se conecta después. Por
 * ahora cada evento decodificado se imprime tal cual quedaría la fila,
 * para validar el mapeo antes de escribir el schema definitivo.
 *
 * Requiere:
 *   - CREDIT_VAULT_ADDRESS   dirección del contrato (env, sin NEXT_PUBLIC_
 *                            porque esto corre server-side, no en el browser)
 *   - ARBITRUM_SEPOLIA_RPC_URL  opcional, usa el RPC público si falta
 *
 * Correr con: npm run indexer
 */
import { publicClient } from "@/lib/web3/publicClient";
import { CREDIT_VAULT_EVENTS_ABI } from "@/lib/web3/events";
import type { ActivityEvent, ActivityKind } from "@/lib/types";

const vaultAddress = process.env.CREDIT_VAULT_ADDRESS as `0x${string}` | undefined;

if (!vaultAddress) {
  console.error(
    "Falta CREDIT_VAULT_ADDRESS — todavía no hay un CreditVault desplegado para escuchar.",
  );
  process.exit(1);
}

const EVENT_TO_KIND: Record<string, ActivityKind> = {
  Invested: "invest",
  MilestoneReleased: "release",
  Repaid: "repayment",
  Defaulted: "default",
  RecoveryDistributed: "recovery",
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
    detail: `${eventName} — opportunityId ${args.opportunityId ?? "?"}`,
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
        const mapped = toActivityEvent(
          log.eventName,
          log.args as Record<string, unknown>,
          log.transactionHash!,
          block.timestamp,
        );
        // TODO: reemplazar por un insert a Supabase cuando el schema esté listo.
        console.log("[indexer]", mapped);
      }
    },
  });
}

main();
