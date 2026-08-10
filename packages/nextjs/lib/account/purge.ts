import { sql } from "@/lib/db/client";

/**
 * Borrado en cascada de todo lo que una wallet dejó en la base.
 *
 * Eliminar la cuenta borraba el usuario en Privy y nada más: el nombre y
 * el documento declarados seguían en `access_applications`, la empresa
 * acreditada en `companies`, los expedientes en `verifier_submissions` y
 * los archivos en `verifier_documents`. La pantalla decía "esta acción no
 * se puede deshacer" y lo que no se podía deshacer era, justamente, que
 * los datos personales se quedaban.
 *
 * **El orden importa y no es negociable**, porque hay claves foráneas:
 *
 *   documentos      → se llegan por `legal_pack_hash`, que vive en el
 *                     expediente y en la empresa: se resuelven ANTES de
 *                     borrar esas dos filas o el archivo queda huérfano
 *   listings        → del mercado secundario, como vendedor o interesado
 *   expedientes     → arrastran `submission_events` por ON DELETE CASCADE
 *   empresa         → la referencian `opportunities(company_id)`
 *
 * `submission_events` no aparece: ya cascadea sola desde el schema.
 */

/** Lo que impide borrar, si algo lo impide. */
export type Bloqueo = { motivo: string };

export type Purga = {
  applications: number;
  submissions: number;
  documents: number;
  listings: number;
  companies: number;
  faucet: number;
  activity: number;
};

/**
 * Una operación publicada NO es dato de esta cuenta.
 *
 * Cuando una empresa llegó a tener una oportunidad en el catálogo, esa
 * fila la referencian inversionistas que pusieron capital: borrarla no
 * sería ejercer el derecho sobre los datos propios, sería destruir el
 * registro de una operación de terceros. Y la clave foránea de
 * `opportunities.company_id` lo impediría igual, solo que fallando con un
 * error de Postgres en vez de con una frase.
 *
 * Se dice antes de tocar nada, no a mitad del borrado.
 */
export async function bloqueoDeBorrado(wallet: string): Promise<Bloqueo | null> {
  const rows = (await sql`
    SELECT o.slug
      FROM opportunities o
      JOIN companies c ON c.id = o.company_id
     WHERE lower(c.wallet) = ${wallet.toLowerCase()}
     LIMIT 1
  `) as { slug: string }[];

  if (rows.length === 0) return null;
  return {
    motivo:
      "Esta cuenta tiene una operación publicada en el catálogo. Borrarla " +
      "eliminaría el registro de una operación que otras personas " +
      "financiaron, así que primero tiene que cerrarse.",
  };
}

/** Borra todo rastro de esta wallet. Devuelve cuántas filas cayó cada tabla. */
export async function purgarCuenta(wallet: string): Promise<Purga> {
  const w = wallet.toLowerCase();

  // `verifier_documents` guarda los bytes indexados por hash y no sabe de
  // quién son: quien los ata a una wallet es `legal_pack_hash`, que vive
  // tanto en el expediente como en la empresa. Hay que resolver esos
  // hashes MIENTRAS esas dos filas existen — después ya no hay por dónde
  // llegar al archivo, y quedaría un PDF con el RUC y las ventas de
  // alguien flotando en la tabla sin nadie que lo reclame.
  //
  // Un hash que además use una oportunidad publicada no se toca: ese
  // archivo es el legal pack que el inversionista puede abrir desde la
  // ficha, y no es dato de esta cuenta nada más. En la práctica no
  // aparece, porque una operación publicada bloquea el borrado entero
  // (ver `bloqueoDeBorrado`); la condición está para que siga siendo
  // cierto si esa regla cambia.
  const docs = (await sql`
    SELECT DISTINCT h.hash FROM (
      SELECT legal_pack_hash AS hash FROM verifier_submissions
       WHERE lower(company_wallet) = ${w}
      UNION
      SELECT legal_pack_hash AS hash FROM companies
       WHERE lower(wallet) = ${w}
    ) h
    WHERE h.hash <> ''
      AND NOT EXISTS (
        SELECT 1 FROM opportunities o WHERE o.legal_pack_hash = h.hash
      )
  `) as { hash: string }[];

  const hashes = docs.map((d) => d.hash);

  const listings = (await sql`
    DELETE FROM position_listings
     WHERE lower(seller_wallet) = ${w}
        OR lower(interested_wallet) = ${w}
    RETURNING id
  `) as unknown[];

  const documents = hashes.length
    ? ((await sql`
        DELETE FROM verifier_documents WHERE hash = ANY(${hashes})
        RETURNING hash
      `) as unknown[])
    : [];

  // Arrastra `submission_events` por la cascada del schema.
  const submissions = (await sql`
    DELETE FROM verifier_submissions WHERE lower(company_wallet) = ${w}
    RETURNING id
  `) as unknown[];

  const companies = (await sql`
    DELETE FROM companies WHERE lower(wallet) = ${w} RETURNING id
  `) as unknown[];

  const applications = (await sql`
    DELETE FROM access_applications WHERE lower(wallet) = ${w} RETURNING wallet
  `) as unknown[];

  const faucet = (await sql`
    DELETE FROM faucet_drips WHERE lower(wallet) = ${w} RETURNING id
  `) as unknown[];

  const activity = (await sql`
    DELETE FROM onchain_activity WHERE lower(investor_address) = ${w}
    RETURNING id
  `) as unknown[];

  return {
    applications: applications.length,
    submissions: submissions.length,
    documents: documents.length,
    listings: listings.length,
    companies: companies.length,
    faucet: faucet.length,
    activity: activity.length,
  };
}
