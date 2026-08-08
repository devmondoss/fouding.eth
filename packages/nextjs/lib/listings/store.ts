import { sql } from "../db/client";

/**
 * Libro de órdenes del mercado secundario.
 *
 * `transfer_position` en el contrato (packages/stylus/contracts/credit-vault)
 * solo mueve la posición entre wallets — no hay pago en USDC on-chain entre
 * comprador y vendedor. Esta tabla es matching + intención: el vendedor
 * publica, un comprador se anota interesado, y es el VENDEDOR quien firma la
 * transferencia real (`transferPosition(to, amount)`) una vez coordinado el
 * pago fuera de cadena. Ver components/flow/PortfolioOverlay.tsx.
 */

export type ListingStatus = "open" | "interested" | "filled" | "cancelled";

export type Listing = {
  id: string;
  opportunitySlug: string;
  sellerWallet: string;
  amount: string;
  price: string;
  status: ListingStatus;
  interestedWallet: string | null;
  filledTxHash: string | null;
  createdAt: string;
};

type ListingRow = {
  id: string;
  opportunity_slug: string;
  seller_wallet: string;
  amount: string;
  price: string;
  status: ListingStatus;
  interested_wallet: string | null;
  filled_tx_hash: string | null;
  created_at: string;
};

function toListing(row: ListingRow): Listing {
  return {
    id: row.id,
    opportunitySlug: row.opportunity_slug,
    sellerWallet: row.seller_wallet,
    amount: row.amount,
    price: row.price,
    status: row.status,
    interestedWallet: row.interested_wallet,
    filledTxHash: row.filled_tx_hash,
    createdAt: row.created_at,
  };
}

export async function listOpenListings(
  opportunitySlug?: string,
): Promise<Listing[]> {
  const rows = (opportunitySlug
    ? await sql`
        SELECT * FROM position_listings
        WHERE opportunity_slug = ${opportunitySlug} AND status IN ('open', 'interested')
        ORDER BY created_at DESC
      `
    : await sql`
        SELECT * FROM position_listings
        WHERE status IN ('open', 'interested')
        ORDER BY created_at DESC
      `) as ListingRow[];
  return rows.map(toListing);
}

export async function listSellerListings(
  sellerWallet: string,
): Promise<Listing[]> {
  const rows = (await sql`
    SELECT * FROM position_listings
    WHERE seller_wallet = ${sellerWallet}
    ORDER BY created_at DESC
  `) as ListingRow[];
  return rows.map(toListing);
}

export async function createListing(input: {
  opportunitySlug: string;
  sellerWallet: string;
  amount: string;
  price: string;
}): Promise<Listing> {
  const rows = (await sql`
    INSERT INTO position_listings
      (opportunity_slug, seller_wallet, amount, price)
    VALUES (
      ${input.opportunitySlug}, ${input.sellerWallet}, ${input.amount}, ${input.price}
    )
    RETURNING *
  `) as ListingRow[];
  return toListing(rows[0]);
}

/** Un comprador se anota interesado — no mueve fondos, solo intención. */
export async function expressInterest(
  id: string,
  wallet: string,
): Promise<Listing | null> {
  const rows = (await sql`
    UPDATE position_listings
    SET interested_wallet = ${wallet}, status = 'interested', updated_at = now()
    WHERE id = ${id} AND status = 'open'
    RETURNING *
  `) as ListingRow[];
  return rows[0] ? toListing(rows[0]) : null;
}

/** El vendedor confirma que ya ejecutó `transferPosition` on-chain. */
export async function markFilled(
  id: string,
  sellerWallet: string,
  txHash: string,
): Promise<Listing | null> {
  const rows = (await sql`
    UPDATE position_listings
    SET status = 'filled', filled_tx_hash = ${txHash}, updated_at = now()
    WHERE id = ${id} AND seller_wallet = ${sellerWallet}
    RETURNING *
  `) as ListingRow[];
  return rows[0] ? toListing(rows[0]) : null;
}

export async function cancelListing(
  id: string,
  sellerWallet: string,
): Promise<Listing | null> {
  const rows = (await sql`
    UPDATE position_listings
    SET status = 'cancelled', updated_at = now()
    WHERE id = ${id} AND seller_wallet = ${sellerWallet} AND status != 'filled'
    RETURNING *
  `) as ListingRow[];
  return rows[0] ? toListing(rows[0]) : null;
}
