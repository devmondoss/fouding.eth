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
      note TEXT
    )
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

  console.log(
    "Migración completa: verifier_submissions, verifier_documents, onchain_activity, rate_limits",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
