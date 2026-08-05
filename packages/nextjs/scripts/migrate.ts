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

  console.log("Migración completa: verifier_submissions, verifier_documents");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
