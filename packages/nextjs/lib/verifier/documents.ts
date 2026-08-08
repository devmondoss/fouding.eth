import { keccak256 } from "viem";
import { sql } from "../db/client";

/**
 * El documento NUNCA sale de acá ni va a la cadena — onchain solo va su
 * hash (legalPackHash en VerifierSubmission), que es literalmente la
 * clave con la que se guarda. Ver docs/conceptos-y-cambios.md §SUNAT:
 * "el documento tiene datos sensibles y se queda en storage privado;
 * onchain va solo su hash".
 *
 * Guardado como bytea en Postgres (Neon) en vez de filesystem: en
 * Vercel el filesystem no persiste entre requests/deploys.
 */
export type StoredDocument = {
  hash: string;
  fileName: string;
  mimeType: string;
  size: number;
};

type DocumentRow = {
  file_name: string;
  mime_type: string;
  size: number;
  bytes: string | Uint8Array;
};

export async function saveDocument(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
): Promise<StoredDocument> {
  const hash = keccak256(bytes);
  await sql`
    INSERT INTO verifier_documents (hash, file_name, mime_type, size, bytes)
    VALUES (${hash}, ${fileName}, ${mimeType}, ${bytes.length}, ${Buffer.from(bytes)})
    ON CONFLICT (hash) DO NOTHING
  `;
  return { hash, fileName, mimeType, size: bytes.length };
}

export async function readDocument(
  hash: string,
): Promise<{ bytes: Buffer; meta: StoredDocument } | null> {
  const rows = (await sql`
    SELECT file_name, mime_type, size, bytes FROM verifier_documents WHERE hash = ${hash}
  `) as DocumentRow[];
  const row = rows[0];
  if (!row) return null;

  // El driver de @neondatabase/serverless ya decodifica bytea a
  // Uint8Array; solo el formato hex de texto ("\x0102fe...") necesita
  // pelarse manualmente, por si el driver cambia de comportamiento.
  const bytes =
    typeof row.bytes === "string"
      ? Buffer.from(row.bytes.startsWith("\\x") ? row.bytes.slice(2) : row.bytes, "hex")
      : Buffer.from(row.bytes);

  return {
    bytes,
    meta: { hash, fileName: row.file_name, mimeType: row.mime_type, size: row.size },
  };
}
