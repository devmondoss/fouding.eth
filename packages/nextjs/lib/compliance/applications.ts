import { keccak256, toBytes, type Hex } from "viem";
import { sql } from "../db/client";

/**
 * Identidad declarada por quien pide acceso como inversionista.
 *
 * La PII se queda en Postgres; onchain va solo `applicationHash`. Y ese
 * hash se calcula SOBRE estos campos, no sobre la dirección sola: eso es
 * lo que ata el registro de la cadena a lo que la persona declaró, y lo
 * que permite demostrar después que el expediente no se cambió.
 */

export type AccessApplication = {
  wallet: string;
  fullName: string;
  documentId: string;
  applicationHash: string;
  createdAt: string;
};

/** Determinista: mismos datos, mismo hash, acá y en el navegador. */
export function applicationHash(input: {
  wallet: string;
  fullName: string;
  documentId: string;
}): Hex {
  return keccak256(
    toBytes(
      JSON.stringify({
        v: 1,
        wallet: input.wallet.toLowerCase(),
        fullName: input.fullName.trim(),
        documentId: input.documentId.trim(),
      }),
    ),
  );
}

type Row = {
  wallet: string;
  full_name: string;
  document_id: string;
  application_hash: string;
  created_at: string | Date;
};

const toApplication = (r: Row): AccessApplication => ({
  wallet: r.wallet,
  fullName: r.full_name,
  documentId: r.document_id,
  applicationHash: r.application_hash,
  createdAt:
    r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
});

export async function saveAccessApplication(input: {
  wallet: string;
  fullName: string;
  documentId: string;
}): Promise<AccessApplication> {
  const hash = applicationHash(input);
  const rows = (await sql`
    INSERT INTO access_applications (wallet, full_name, document_id, application_hash)
    VALUES (${input.wallet.toLowerCase()}, ${input.fullName.trim()}, ${input.documentId.trim()}, ${hash})
    ON CONFLICT (wallet) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      document_id = EXCLUDED.document_id,
      application_hash = EXCLUDED.application_hash,
      updated_at = now()
    RETURNING *
  `) as Row[];
  return toApplication(rows[0]);
}

/** Para el panel de compliance: qué declaró cada wallet que pidió acceso. */
export async function listAccessApplications(): Promise<
  Map<string, AccessApplication>
> {
  const rows = (await sql`SELECT * FROM access_applications`) as Row[];
  return new Map(rows.map((r) => [r.wallet.toLowerCase(), toApplication(r)]));
}
