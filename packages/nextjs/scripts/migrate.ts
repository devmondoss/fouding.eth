import { sql } from "../lib/db/client";

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS verifier_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_name TEXT NOT NULL,
      company_ruc TEXT NOT NULL DEFAULT '',
      company_wallet TEXT NOT NULL,
      project_title TEXT NOT NULL,
      requested_amount TEXT NOT NULL,
      legal_pack_hash TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      decided_at TIMESTAMPTZ,
      decided_by TEXT,
      note TEXT,
      passport_tx_hash TEXT,
      passport_token_id TEXT,
      passport_chain_id INTEGER,
      passport_contract_address TEXT,
      onchain_synced_at TIMESTAMPTZ
    )
  `;

  await sql`
    ALTER TABLE verifier_submissions
      ADD COLUMN IF NOT EXISTS passport_tx_hash TEXT,
      ADD COLUMN IF NOT EXISTS passport_token_id TEXT,
      ADD COLUMN IF NOT EXISTS passport_chain_id INTEGER,
      ADD COLUMN IF NOT EXISTS passport_contract_address TEXT,
      ADD COLUMN IF NOT EXISTS onchain_synced_at TIMESTAMPTZ
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS verifier_submissions_company_wallet_idx
    ON verifier_submissions (lower(company_wallet), submitted_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS verifier_documents (
      hash TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      bytes BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Destino real del indexer (scripts/indexer.ts) — hoy no recibe filas
  // porque no hay CreditVault desplegado a quién escuchar, pero la tabla
  // ya existe para que conectar el contrato real sea solo pegar la
  // dirección, no escribir un schema nuevo.
  await sql`
    CREATE TABLE IF NOT EXISTS onchain_activity (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      investor_address TEXT,
      opportunity_onchain_id TEXT,
      amount NUMERIC,
      detail TEXT,
      occurred_at TIMESTAMPTZ NOT NULL,
      inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Ventana fija de rate limiting para las rutas del verificador — ver
  // lib/verifier/rateLimit.ts. (key, window_start) como PK: cada request
  // dentro de la misma ventana de 1 minuto suma al mismo contador.
  await sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT NOT NULL,
      window_start TIMESTAMPTZ NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (key, window_start)
    )
  `;

  // La empresa prestataria. Vive aparte de la oportunidad porque una
  // empresa puede volver a pedir capital y su pasaporte es ACUMULATIVO:
  // el historial de pagos es justamente lo que hace que el segundo
  // crédito salga mejor que el primero (ver conceptos-y-cambios.md §SBT).
  await sql`
    CREATE TABLE IF NOT EXISTS companies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ruc TEXT NOT NULL UNIQUE,
      wallet TEXT NOT NULL,
      name TEXT NOT NULL,
      sector TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      years_operating INTEGER NOT NULL DEFAULT 0,
      employees INTEGER NOT NULL DEFAULT 0,
      passport JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // El catálogo real. Hasta ahora las oportunidades solo existían en
  // lib/data/seed.ts, así que un expediente aprobado no producía nada:
  // el circuito empresa → verificador → inversionista estaba cortado
  // justo acá.
  //
  // Montos en TEXT, no NUMERIC: son bigint de micro-USDC y TEXT los
  // devuelve exactos, sin pasar por el float de JS (misma convención que
  // verifier_submissions.requested_amount).
  //
  // collateral/milestones/highlights van en JSONB porque son structs que
  // se leen y escriben enteros, nunca se consultan por campo — normalizar
  // tres tablas más no compraría nada hoy.
  //
  // vault_address es la costura con el protocolo: la escribe quien
  // despliega el vault de esta oportunidad. Nula mientras no exista.
  await sql`
    CREATE TABLE IF NOT EXISTS opportunities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT NOT NULL UNIQUE,
      company_id UUID NOT NULL REFERENCES companies(id),
      submission_id UUID REFERENCES verifier_submissions(id),
      project_title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
      target_amount TEXT NOT NULL,
      raised_amount TEXT NOT NULL DEFAULT '0',
      borrower_contribution_bps INTEGER NOT NULL DEFAULT 0,
      term_months INTEGER NOT NULL,
      apy_bps INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'funding',
      collateral JSONB NOT NULL,
      milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
      legal_pack_hash TEXT NOT NULL DEFAULT '',
      funding_deadline DATE NOT NULL,
      investor_count INTEGER NOT NULL DEFAULT 0,
      recovered_amount TEXT,
      vault_address TEXT,
      published_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Identidad declarada por quien pide acceso como inversionista.
  //
  // Vive acá y NO en cadena porque es PII (stack.md §4). Lo que va onchain
  // es `application_hash`, que se calcula sobre estos mismos campos: así el
  // registro de la cadena queda atado a lo declarado y no es un hash
  // decorativo. Antes el formulario pedía nombre y documento y los tiraba
  // en el cliente, con lo cual compliance aprobaba a ciegas.
  await sql`
    CREATE TABLE IF NOT EXISTS access_applications (
      wallet TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      document_id TEXT NOT NULL,
      application_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Un expediente no puede publicarse dos veces.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS opportunities_submission_id_key
      ON opportunities (submission_id)
      WHERE submission_id IS NOT NULL
  `;

  console.log(
    "Migración completa: verifier_submissions + passport receipt, verifier_documents, onchain_activity, rate_limits, companies, opportunities, access_applications",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
