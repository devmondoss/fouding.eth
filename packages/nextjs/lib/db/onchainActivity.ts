import { sql } from "./client";

export type OnchainActivityInput = {
  id: string; // tx hash
  kind: string;
  investorAddress: string | null;
  opportunityOnchainId: string | null;
  amount: bigint | null;
  detail: string;
  occurredAt: Date;
};

export async function insertOnchainActivity(
  event: OnchainActivityInput,
): Promise<void> {
  await sql`
    INSERT INTO onchain_activity
      (id, kind, investor_address, opportunity_onchain_id, amount, detail, occurred_at)
    VALUES
      (${event.id}, ${event.kind}, ${event.investorAddress}, ${event.opportunityOnchainId}, ${event.amount?.toString() ?? null}, ${event.detail}, ${event.occurredAt.toISOString()})
    ON CONFLICT (id) DO NOTHING
  `;
}

/** Forma de transporte de un evento: `amount` como string por el bigint. */
export type WireActivityEvent = {
  id: string;
  at: string;
  kind: string;
  opportunitySlug: string | null;
  title: string;
  detail: string;
  amount: string | null;
  direction: "in" | "out" | "none";
};

/** Signo respecto del saldo del inversionista. */
const DIRECTION: Record<string, "in" | "out" | "none"> = {
  invest: "out",
  repayment: "in",
  recovery: "in",
  release: "none",
  default: "none",
};

const TITLE: Record<string, string> = {
  invest: "Inversión confirmada",
  repayment: "Pago recibido",
  recovery: "Distribución del recupero",
  release: "Hito liberado",
  default: "Incumplimiento declarado",
};

type ActivityRow = {
  id: string;
  kind: string;
  amount: string | null;
  detail: string;
  occurred_at: string | Date;
  slug: string | null;
  project_title: string | null;
  company_name: string | null;
};

/**
 * Actividad real del inversionista, tal como la escribió el indexer desde
 * los eventos del CreditVault (ver scripts/indexer.ts).
 *
 * El join contra `opportunities.vault_address` es lo que convierte una
 * fila anónima ("deal 0x23e4…") en algo legible: sin esa columna el
 * indexer produce datos que nadie puede mostrar.
 */
export async function listActivityForInvestor(
  wallet: string,
): Promise<WireActivityEvent[]> {
  const rows = (await sql`
    SELECT
      a.id, a.kind, a.amount, a.detail, a.occurred_at,
      o.slug, o.project_title, c.name AS company_name
    FROM onchain_activity a
    LEFT JOIN opportunities o
      ON lower(o.vault_address) = lower(a.opportunity_onchain_id)
    LEFT JOIN companies c ON c.id = o.company_id
    WHERE lower(a.investor_address) = lower(${wallet})
    ORDER BY a.occurred_at DESC
    LIMIT 200
  `) as ActivityRow[];

  return rows.map((r) => ({
    id: r.id,
    at:
      r.occurred_at instanceof Date
        ? r.occurred_at.toISOString()
        : r.occurred_at,
    kind: r.kind,
    opportunitySlug: r.slug,
    title: TITLE[r.kind] ?? r.kind,
    detail: r.project_title
      ? `${r.project_title}${r.company_name ? ` — ${r.company_name}` : ""}`
      : r.detail,
    amount: r.amount,
    direction: DIRECTION[r.kind] ?? "none",
  }));
}
