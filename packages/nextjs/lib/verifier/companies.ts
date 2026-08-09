import "server-only";

import { sql } from "../db/client";

/**
 * La empresa como sujeto acreditado, aparte de sus solicitudes.
 *
 * Antes acreditar a la empresa y aprobar una operación eran el mismo
 * trámite: el primer expediente aprobado emitía el pasaporte y de paso
 * aprobaba un proyecto. Eso tenía dos costos. La empresa no existía como
 * sujeto hasta que le aprobaban un crédito entero —así que su panel no
 * podía decirle nada— y cada solicitud volvía a pedirle RUC, sector y
 * años de operación, datos que no cambian entre un proyecto y el
 * siguiente.
 *
 * Acá la empresa se verifica una vez, recibe su pasaporte onchain, y las
 * solicitudes cuelgan de esa acreditación. Es el orden del crédito real,
 * y es lo que hace que el segundo crédito sea más barato de tramitar que
 * el primero (docs/conceptos-y-cambios.md §SBT).
 */

export type CompanyStatus = "pending" | "in_review" | "verified" | "rejected";

export type Company = {
  id: string;
  ruc: string;
  wallet: string;
  name: string;
  sector: string;
  city: string;
  yearsOperating: number;
  employees: number;
  /** Ventas del último año declaradas, en USDC enteros. */
  annualRevenue: string;
  legalPackHash: string;
  legalPackName: string;
  status: CompanyStatus;
  submittedAt: string;
  reviewer: string | null;
  reviewStartedAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  note: string | null;
  passportTxHash: string | null;
  passportTokenId: string | null;
  passportChainId: number | null;
  passportContractAddress: string | null;
};

type Row = {
  id: string;
  ruc: string;
  wallet: string;
  name: string;
  sector: string;
  city: string;
  years_operating: number;
  employees: number;
  annual_revenue: string;
  legal_pack_hash: string;
  legal_pack_name: string;
  status: CompanyStatus;
  submitted_at: string;
  reviewer: string | null;
  review_started_at: string | null;
  decided_at: string | null;
  decided_by: string | null;
  note: string | null;
  passport_tx_hash: string | null;
  passport_token_id: string | null;
  passport_chain_id: number | null;
  passport_contract_address: string | null;
};

function toCompany(row: Row): Company {
  return {
    id: row.id,
    ruc: row.ruc,
    wallet: row.wallet,
    name: row.name,
    sector: row.sector ?? "",
    city: row.city ?? "",
    yearsOperating: row.years_operating ?? 0,
    employees: row.employees ?? 0,
    annualRevenue: row.annual_revenue ?? "",
    legalPackHash: row.legal_pack_hash ?? "",
    legalPackName: row.legal_pack_name ?? "",
    status: row.status,
    submittedAt: row.submitted_at,
    reviewer: row.reviewer,
    reviewStartedAt: row.review_started_at,
    decidedAt: row.decided_at,
    decidedBy: row.decided_by,
    note: row.note,
    passportTxHash: row.passport_tx_hash,
    passportTokenId: row.passport_token_id,
    passportChainId: row.passport_chain_id,
    passportContractAddress: row.passport_contract_address,
  };
}

/** La empresa de esta wallet. Una wallet acredita una sola empresa. */
export async function getCompanyByWallet(wallet: string): Promise<Company | null> {
  const rows = (await sql`
    SELECT * FROM companies WHERE lower(wallet) = lower(${wallet}) LIMIT 1
  `) as Row[];
  return rows[0] ? toCompany(rows[0]) : null;
}

export async function getCompany(id: string): Promise<Company | null> {
  const rows = (await sql`SELECT * FROM companies WHERE id = ${id} LIMIT 1`) as Row[];
  return rows[0] ? toCompany(rows[0]) : null;
}

/** Cola del verificador: lo que espera acreditación primero. */
export async function listCompanies(): Promise<Company[]> {
  const rows = (await sql`
    SELECT * FROM companies
    ORDER BY
      CASE status WHEN 'pending' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END,
      submitted_at DESC
  `) as Row[];
  return rows.map(toCompany);
}

export type SubmitCompanyInput = {
  ruc: string;
  wallet: string;
  name: string;
  sector: string;
  city: string;
  yearsOperating: number;
  employees: number;
  annualRevenue: string;
  legalPackHash: string;
  legalPackName: string;
};

/**
 * Enviar la empresa a acreditación. Reenviar corrige lo observado: una
 * empresa rechazada puede volver a intentarlo sin crear una fila nueva,
 * porque el RUC la identifica y su historial de pagos cuelga de ahí.
 *
 * Una empresa ya verificada NO se toca: sus datos los confirmó un
 * verificador y cambiarlos por su cuenta invalidaría esa revisión.
 */
export async function submitCompany(input: SubmitCompanyInput): Promise<Company> {
  const rows = (await sql`
    INSERT INTO companies (
      ruc, wallet, name, sector, city, years_operating, employees,
      annual_revenue, legal_pack_hash, legal_pack_name, status, submitted_at
    ) VALUES (
      ${input.ruc}, ${input.wallet}, ${input.name}, ${input.sector}, ${input.city},
      ${input.yearsOperating}, ${input.employees}, ${input.annualRevenue},
      ${input.legalPackHash}, ${input.legalPackName}, 'pending', now()
    )
    ON CONFLICT (ruc) DO UPDATE SET
      wallet = EXCLUDED.wallet,
      name = EXCLUDED.name,
      sector = EXCLUDED.sector,
      city = EXCLUDED.city,
      years_operating = EXCLUDED.years_operating,
      employees = EXCLUDED.employees,
      annual_revenue = EXCLUDED.annual_revenue,
      legal_pack_hash = EXCLUDED.legal_pack_hash,
      legal_pack_name = EXCLUDED.legal_pack_name,
      status = 'pending',
      submitted_at = now(),
      reviewer = NULL,
      review_started_at = NULL,
      decided_at = NULL,
      decided_by = NULL,
      note = NULL
    WHERE companies.status <> 'verified'
    RETURNING *
  `) as Row[];

  if (!rows[0]) {
    // El ON CONFLICT no actualizó nada: ese RUC ya está verificado.
    throw new CompanyAlreadyVerified(
      "Ese RUC ya está verificado por otra cuenta. Escríbenos si es tu empresa",
    );
  }
  return toCompany(rows[0]);
}

export class CompanyAlreadyVerified extends Error {}

/** Un verificador toma la empresa. Mismo candado optimista que un expediente. */
export async function claimCompany(
  id: string,
  reviewer: string,
): Promise<Company | null> {
  const rows = (await sql`
    UPDATE companies
    SET status = 'in_review', reviewer = ${reviewer}, review_started_at = now()
    WHERE id = ${id} AND status = 'pending'
    RETURNING *
  `) as Row[];
  return rows[0] ? toCompany(rows[0]) : null;
}

export type CompanyDecision = {
  approve: boolean;
  decidedBy: string;
  note?: string;
  passport?: {
    txHash: string;
    tokenId: string;
    chainId: number;
    contractAddress: string;
  };
};

export async function decideCompany(
  id: string,
  decision: CompanyDecision,
): Promise<Company | null> {
  const status: CompanyStatus = decision.approve ? "verified" : "rejected";
  const p = decision.passport;
  const rows = (await sql`
    UPDATE companies
    SET status = ${status},
        decided_at = now(),
        decided_by = ${decision.decidedBy},
        reviewer = COALESCE(reviewer, ${decision.decidedBy}),
        note = ${decision.note ?? null},
        passport_tx_hash = ${p?.txHash ?? null},
        passport_token_id = ${p?.tokenId ?? null},
        passport_chain_id = ${p?.chainId ?? null},
        passport_contract_address = ${p?.contractAddress ?? null},
        onchain_synced_at = ${p ? new Date().toISOString() : null}
    WHERE id = ${id}
    RETURNING *
  `) as Row[];
  return rows[0] ? toCompany(rows[0]) : null;
}
