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

  // El expediente pasó de cinco campos a un legajo. Antes el verificador
  // tenía que decidir con nombre, RUC y un monto suelto — no alcanzaba ni
  // para saber a qué plazo ni contra qué garantía. `reviewer` y
  // `review_started_at` existen porque el dueño del negocio preguntaba
  // "¿quién está revisando esto?" y la respuesta no estaba en ningún lado.
  //
  // Montos en TEXT, en USDC enteros tal como los teclea la empresa (misma
  // convención que requested_amount, ver nota de `opportunities`).
  await sql`
    ALTER TABLE verifier_submissions
      ADD COLUMN IF NOT EXISTS sector TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS years_operating INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS annual_revenue TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS term_months INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS use_of_funds TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS collateral_kind TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS collateral_value TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS collateral_detail TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS legal_pack_name TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS reviewer TEXT,
      ADD COLUMN IF NOT EXISTS review_started_at TIMESTAMPTZ
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS verifier_submissions_company_wallet_idx
    ON verifier_submissions (lower(company_wallet), submitted_at DESC)
  `;

  // Bitácora del expediente: quién hizo qué y cuándo, append-only.
  //
  // El estado del expediente ya vivía en `verifier_submissions.status`,
  // pero un estado no cuenta una historia: la empresa veía "Pendiente" sin
  // saber si alguien lo había tomado, y al aprobarse se perdía el rastro
  // de la revisión. Cada transición escribe acá una fila y nunca se borra
  // ni se edita — es lo que la empresa lee como seguimiento y lo que
  // sostiene el honorario fijo del verificador (un expediente revisado es
  // un expediente con eventos, apruebe o rechace).
  await sql`
    CREATE TABLE IF NOT EXISTS submission_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      submission_id UUID NOT NULL REFERENCES verifier_submissions(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT '',
      actor_role TEXT NOT NULL DEFAULT 'system',
      detail TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS submission_events_submission_idx
      ON submission_events (submission_id, created_at)
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

  // Registro de la dispensadora de saldo de prueba (lib/faucet). Sostiene
  // el enfriamiento por wallet y el tope diario, y deja el rastro de a
  // quién se le regaló qué — en testnet no es dinero, pero sí es gas real
  // de una cuenta que alguien tiene que reponer.
  await sql`
    CREATE TABLE IF NOT EXISTS faucet_drips (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet TEXT NOT NULL,
      token_amount TEXT NOT NULL DEFAULT '0',
      gas_wei TEXT NOT NULL DEFAULT '0',
      token_tx_hash TEXT,
      gas_tx_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS faucet_drips_wallet_idx
      ON faucet_drips (lower(wallet), created_at DESC)
  `;

  // La empresa prestataria. Vive aparte de la oportunidad porque una
  // empresa puede volver a pedir capital y su pasaporte es ACUMULATIVO:
  // el historial de pagos es justamente lo que hace que el segundo
  // crédito salga mejor que el primero (ver docs/conceptos-y-cambios.md §SBT).
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

  // La empresa se acredita UNA VEZ y después pide las operaciones que
  // quiera. Antes las dos cosas ocurrían en el mismo trámite: el primer
  // expediente aprobado emitía el pasaporte y de paso aprobaba un
  // proyecto, así que una empresa no tenía ningún estado propio hasta
  // que le aprobaban un crédito entero — y volvía a declarar RUC, sector
  // y años en cada solicitud.
  //
  // Ahora `companies` lleva su propia revisión (misma máquina de estados
  // que un expediente) y es la dueña del pasaporte onchain.
  await sql`
    ALTER TABLE companies
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'verified',
      ADD COLUMN IF NOT EXISTS annual_revenue TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS legal_pack_hash TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS legal_pack_name TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS reviewer TEXT,
      ADD COLUMN IF NOT EXISTS review_started_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS decided_by TEXT,
      ADD COLUMN IF NOT EXISTS note TEXT,
      ADD COLUMN IF NOT EXISTS passport_tx_hash TEXT,
      ADD COLUMN IF NOT EXISTS passport_token_id TEXT,
      ADD COLUMN IF NOT EXISTS passport_chain_id INTEGER,
      ADD COLUMN IF NOT EXISTS passport_contract_address TEXT,
      ADD COLUMN IF NOT EXISTS onchain_synced_at TIMESTAMPTZ
  `;

  // `status` nace en 'verified' a propósito: las empresas que ya existían
  // llegaron ahí por un expediente aprobado y publicado, así que dejarlas
  // pendientes sería inventarles una revisión que sí ocurrió.
  await sql`
    CREATE INDEX IF NOT EXISTS companies_wallet_idx
      ON companies (lower(wallet))
  `;

  // Una solicitud cuelga de una empresa acreditada. Es NULL solo para los
  // expedientes viejos, que nacieron cuando empresa y proyecto eran el
  // mismo trámite.
  await sql`
    ALTER TABLE verifier_submissions
      ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id)
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
  // Vive acá y NO en cadena porque es PII (docs/stack.md §4). Lo que va onchain
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

  // Libro de órdenes del mercado secundario. `transfer_position` en el
  // contrato solo mueve la posición — no liquida el pago en USDC entre
  // comprador y vendedor, así que esta tabla es matching + intención, no
  // custodia. `interested_wallet` es quien se anota; el vendedor decide si
  // ejecuta la transferencia real y con qué monto (puede ser parcial).
  // Montos en TEXT por la misma razón que en `opportunities`: son bigint de
  // micro-USDC.
  await sql`
    CREATE TABLE IF NOT EXISTS position_listings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      opportunity_slug TEXT NOT NULL REFERENCES opportunities(slug),
      seller_wallet TEXT NOT NULL,
      amount TEXT NOT NULL,
      price TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      interested_wallet TEXT,
      filled_tx_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS position_listings_opportunity_idx
      ON position_listings (opportunity_slug)
      WHERE status = 'open'
  `;

  console.log(
    "Migración completa: verifier_submissions + expediente extendido + passport receipt, submission_events, verifier_documents, onchain_activity, rate_limits, faucet_drips, companies, opportunities, access_applications, position_listings",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
