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
