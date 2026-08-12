import { sql } from "../db/client";
import type { Milestone, OpportunityStatus } from "../types";
import type { WireCollateral, WireOpportunity, WirePassport } from "./wire";

/**
 * Acceso a datos del catálogo. Devuelve SIEMPRE la forma de transporte
 * (montos como string) — quien la consume decide si la convierte a
 * bigint; ver lib/opportunities/wire.ts.
 */

type OpportunityRow = {
  id: string;
  slug: string;
  project_title: string;
  summary: string;
  highlights: string[];
  target_amount: string;
  raised_amount: string;
  borrower_contribution_bps: number;
  term_months: number;
  apy_bps: number;
  status: OpportunityStatus;
  collateral: WireCollateral;
  milestones: Milestone[];
  legal_pack_hash: string;
  funding_deadline: string;
  investor_count: number;
  recovered_amount: string | null;
  vault_address: string | null;
  // company, por el join
  company_id: string;
  company_name: string;
  company_ruc: string;
  company_sector: string;
  company_city: string;
  company_years_operating: number;
  company_employees: number;
  company_passport: WirePassport;
};

/** `funding_deadline` es DATE; el driver puede devolver Date o string. */
function toIsoDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function toWire(row: OpportunityRow): WireOpportunity {
  return {
    id: row.id,
    slug: row.slug,
    projectTitle: row.project_title,
    summary: row.summary,
    highlights: row.highlights ?? [],
    targetAmount: row.target_amount,
    raisedAmount: row.raised_amount,
    borrowerContributionBps: row.borrower_contribution_bps,
    termMonths: row.term_months,
    apyBps: row.apy_bps,
    status: row.status,
    collateral: row.collateral,
    milestones: row.milestones ?? [],
    legalPackHash: row.legal_pack_hash,
    fundingDeadline: toIsoDate(row.funding_deadline),
    investorCount: row.investor_count,
    recoveredAmount: row.recovered_amount,
    vaultAddress: row.vault_address,
    company: {
      id: row.company_id,
      name: row.company_name,
      ruc: row.company_ruc,
      sector: row.company_sector,
      city: row.company_city,
      yearsOperating: row.company_years_operating,
      employees: row.company_employees,
      passport: row.company_passport,
    },
  };
}

export async function listOpportunities(): Promise<WireOpportunity[]> {
  const rows = (await sql`
    SELECT
      o.*,
      c.id   AS company_id,
      c.name AS company_name,
      c.ruc  AS company_ruc,
      c.sector AS company_sector,
      c.city AS company_city,
      c.years_operating AS company_years_operating,
      c.employees AS company_employees,
      c.passport AS company_passport
    FROM opportunities o
    JOIN companies c ON c.id = o.company_id
    ORDER BY o.published_at DESC
  `) as OpportunityRow[];
  return rows.map(toWire);
}

export async function getOpportunityBySlug(
  slug: string,
): Promise<WireOpportunity | null> {
  const rows = (await sql`
    SELECT
      o.*,
      c.id   AS company_id,
      c.name AS company_name,
      c.ruc  AS company_ruc,
      c.sector AS company_sector,
      c.city AS company_city,
      c.years_operating AS company_years_operating,
      c.employees AS company_employees,
      c.passport AS company_passport
    FROM opportunities o
    JOIN companies c ON c.id = o.company_id
    WHERE o.slug = ${slug}
    LIMIT 1
  `) as OpportunityRow[];
  return rows[0] ? toWire(rows[0]) : null;
}

/** Pasaporte de una empresa que aún no tiene historial en la plataforma. */
const NEW_PASSPORT: WirePassport = {
  tokenId: 0,
  issuedAt: new Date().toISOString().slice(0, 10),
  verifiedRevenue: "0",
  completedDeals: 0,
  onTimeRepayments: 0,
  lateRepayments: 0,
  defaults: 0,
};

export type UpsertCompanyInput = {
  ruc: string;
  wallet: string;
  name: string;
  sector: string;
  city: string;
  yearsOperating: number;
  employees: number;
  verifiedRevenue: string;
};

/**
 * El RUC identifica a la empresa, no la wallet: si vuelve a pedir capital
 * queremos la MISMA fila y por lo tanto el mismo pasaporte acumulado. Los
 * contadores de historial (`completedDeals`, pagos, defaults) nunca se
 * pisan acá — solo los mueve el ciclo de vida del crédito.
 */
export async function upsertCompany(input: UpsertCompanyInput): Promise<string> {
  const rows = (await sql`
    INSERT INTO companies
      (ruc, wallet, name, sector, city, years_operating, employees, passport)
    VALUES (
      ${input.ruc}, ${input.wallet}, ${input.name}, ${input.sector},
      ${input.city}, ${input.yearsOperating}, ${input.employees},
      ${JSON.stringify({ ...NEW_PASSPORT, verifiedRevenue: input.verifiedRevenue })}::jsonb
    )
    ON CONFLICT (ruc) DO UPDATE SET
      wallet = EXCLUDED.wallet,
      name = EXCLUDED.name,
      sector = EXCLUDED.sector,
      city = EXCLUDED.city,
      years_operating = EXCLUDED.years_operating,
      employees = EXCLUDED.employees,
      passport = jsonb_set(
        companies.passport,
        '{verifiedRevenue}',
        to_jsonb(${input.verifiedRevenue}::text)
      )
    RETURNING id
  `) as { id: string }[];
  return rows[0].id;
}

export type CreateOpportunityInput = {
  slug: string;
  companyId: string;
  submissionId: string | null;
  projectTitle: string;
  summary: string;
  highlights: string[];
  targetAmount: string;
  borrowerContributionBps: number;
  termMonths: number;
  apyBps: number;
  collateral: WireCollateral;
  milestones: Milestone[];
  legalPackHash: string;
  fundingDeadline: string;
};

export async function createOpportunity(
  input: CreateOpportunityInput,
): Promise<WireOpportunity> {
  const rows = (await sql`
    INSERT INTO opportunities (
      slug, company_id, submission_id, project_title, summary, highlights,
      target_amount, borrower_contribution_bps, term_months, apy_bps,
      status, collateral, milestones, legal_pack_hash, funding_deadline
    ) VALUES (
      ${input.slug}, ${input.companyId}, ${input.submissionId},
      ${input.projectTitle}, ${input.summary},
      ${JSON.stringify(input.highlights)}::jsonb,
      ${input.targetAmount}, ${input.borrowerContributionBps},
      ${input.termMonths}, ${input.apyBps},
      'funding',
      ${JSON.stringify(input.collateral)}::jsonb,
      ${JSON.stringify(input.milestones)}::jsonb,
      ${input.legalPackHash}, ${input.fundingDeadline}
    )
    RETURNING id
  `) as { id: string }[];

  const created = await getOpportunityBySlug(input.slug);
  if (!created) {
    throw new Error(`La oportunidad ${rows[0].id} no se pudo releer tras crearla`);
  }
  return created;
}

/** Slug estable y legible a partir del título. Se le agrega sufijo si choca. */
export async function uniqueSlug(base: string): Promise<string> {
  const root =
    base
      .normalize("NFD")
      // Combining diacritics: "Camión" -> "Camion", escapado por punto de
      // código para que el archivo no dependa de su propia codificación.
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "oportunidad";

  const rows = (await sql`
    SELECT slug FROM opportunities WHERE slug = ${root} OR slug LIKE ${root + "-%"}
  `) as { slug: string }[];

  if (!rows.some((r) => r.slug === root)) return root;
  const taken = new Set(rows.map((r) => r.slug));
  for (let i = 2; i < 1000; i++) {
    const candidate = `${root}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`No se pudo generar un slug único para "${base}"`);
}

/**
 * Ata el CreditVault desplegado a esta oportunidad — la escribe quien
 * despliega el vault (script de deploy o el panel del verificador), no la
 * publicación inicial (ver comentario de la columna en scripts/migrate.ts).
 */
export async function setOpportunityVaultAddress(
  slug: string,
  vaultAddress: string,
): Promise<WireOpportunity | null> {
  await sql`
    UPDATE opportunities SET vault_address = ${vaultAddress} WHERE slug = ${slug}
  `;
  return getOpportunityBySlug(slug);
}

/**
 * Pone la recaudación del catálogo a lo que dice la cadena.
 *
 * Hasta ahora `raised_amount` solo se movía cuando alguien lo escribía a
 * mano: después de la inversión de prueba del 9 de agosto hubo que
 * corregirlo con un UPDATE. Con el catálogo sembrado eso no molesta —
 * ninguna cifra pretende ser real—, pero en cuanto una persona invierte
 * en vivo la tarjeta empieza a mentir sobre cuánto lleva colocado una
 * operación, que es justo el dato con el que se decide.
 *
 * La unidad ya coincide y no hay conversión: `raised_amount` se guarda
 * en micro-USDC (`usdc(118_500)` en el seed) y `getAccounting` devuelve
 * las unidades base del token, que para `MockUSDC` son las mismas seis
 * decimales. Convertir acá sería el error clásico de mostrar mil
 * millones donde van dos mil.
 *
 * **`investor_count` NO se toca.** Se podría contar de `onchain_activity`,
 * pero el indexer solo ve los eventos desde que arranca: una oportunidad
 * fondeada antes daría cero y la tarjeta pasaría de un número sembrado a
 * uno falso. Preferible que quede viejo a que quede inventado.
 *
 * Devuelve el slug que se actualizó, o null si ninguna oportunidad
 * apunta a ese vault.
 */
export async function syncRaisedFromVault(
  vaultAddress: string,
  raisedAmount: bigint,
): Promise<string | null> {
  const rows = (await sql`
    UPDATE opportunities
       SET raised_amount = ${raisedAmount.toString()}
     WHERE lower(vault_address) = ${vaultAddress.toLowerCase()}
    RETURNING slug
  `) as { slug: string }[];
  return rows[0]?.slug ?? null;
}

export async function getOpportunityBySubmission(
  submissionId: string,
): Promise<WireOpportunity | null> {
  const rows = (await sql`
    SELECT slug FROM opportunities WHERE submission_id = ${submissionId} LIMIT 1
  `) as { slug: string }[];
  return rows[0] ? getOpportunityBySlug(rows[0].slug) : null;
}
