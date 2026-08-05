import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { keccak256 } from "viem";

/**
 * Storage TEMPORAL de documentos — mismo criterio que lib/verifier/store.ts:
 * archivo local mientras no hay Supabase Storage, misma forma de API para
 * que el swap sea mecánico después.
 *
 * El documento NUNCA sale de acá ni va a la cadena — onchain solo va su
 * hash (legalPackHash en VerifierSubmission), que es literalmente el
 * nombre de archivo con el que se guarda. Ver conceptos-y-cambios.md
 * §SUNAT: "el documento tiene datos sensibles y se queda en storage
 * privado; onchain va solo su hash".
 */
const DOCS_DIR = path.join(process.cwd(), ".data", "documents");

export type StoredDocument = {
  hash: string;
  fileName: string;
  mimeType: string;
  size: number;
};

function metaPath(hash: string) {
  return path.join(DOCS_DIR, `${hash}.json`);
}

function filePath(hash: string) {
  return path.join(DOCS_DIR, hash);
}

export async function saveDocument(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
): Promise<StoredDocument> {
  const hash = keccak256(bytes);
  await mkdir(DOCS_DIR, { recursive: true });
  await writeFile(filePath(hash), bytes);

  const meta: StoredDocument = { hash, fileName, mimeType, size: bytes.length };
  await writeFile(metaPath(hash), JSON.stringify(meta, null, 2), "utf-8");
  return meta;
}

export async function readDocument(
  hash: string,
): Promise<{ bytes: Buffer; meta: StoredDocument } | null> {
  try {
    const [bytes, rawMeta] = await Promise.all([
      readFile(filePath(hash)),
      readFile(metaPath(hash), "utf-8"),
    ]);
    return { bytes, meta: JSON.parse(rawMeta) as StoredDocument };
  } catch {
    return null;
  }
}
