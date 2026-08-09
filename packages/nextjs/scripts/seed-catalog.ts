import { randomUUID } from "node:crypto";
import { sql } from "../lib/db/client";
import { HAIRCUT_BY_KIND, type CollateralKind } from "../lib/types";

/**
 * Siembra el catálogo con 80 operaciones completas.
 *
 * El catálogo real sale de Postgres y estaba vacío, así que la app caía
 * al seed de seis oportunidades de lib/data/seed.ts y lo avisaba en
 * pantalla ("ningún verificador publicó todavía"). Con seis tarjetas no
 * se ve lo que el producto hace: ni el paginado, ni los filtros por
 * estado, ni la dispersión de score y cobertura.
 *
 * Cada operación se siembra por el camino completo del dominio —empresa,
 * expediente aprobado, bitácora y oportunidad publicada— y no como una
 * fila suelta en `opportunities`. Así el panel del verificador, el
 * seguimiento de la empresa y el catálogo cuentan la MISMA historia, que
 * es justo lo que se rompía cuando los datos de demostración vivían solo
 * del lado del catálogo.
 *
 *   yarn seed:catalogo            siembra (idempotente: reemplaza lo sembrado)
 *   yarn seed:catalogo --limpiar  borra lo sembrado y no siembra nada
 *
 * Lo sembrado se reconoce por la wallet: todas empiezan en 0x5EED…, así
 * que jamás toca un expediente enviado de verdad desde la app.
 */

const CANTIDAD = 80;
/** Expedientes que quedan sin publicar, para que la cola del verificador
 * no aparezca vacía: la bandeja es una pantalla del producto. */
const EN_COLA = 7;
const MARCA = "0x5EED";
const HOY = new Date("2026-08-09T00:00:00Z");

/** PRNG con semilla: la siembra tiene que ser igual en cada máquina, o
 * dos personas viendo "la misma demo" ven catálogos distintos. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = prng(20260809);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const entre = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

const SECTORES = [
  { nombre: "Agroindustria", ciudades: ["Ica", "Piura", "Moyobamba", "Chiclayo", "Trujillo"] },
  { nombre: "Manufactura", ciudades: ["Lima", "Arequipa", "Trujillo", "Huancayo"] },
  { nombre: "Textil y confecciones", ciudades: ["Lima", "Arequipa", "Cusco", "Puno"] },
  { nombre: "Transporte y logística", ciudades: ["Callao", "Trujillo", "Arequipa", "Pucallpa"] },
  { nombre: "Pesca y acuicultura", ciudades: ["Paita", "Chimbote", "Ilo", "Pisco"] },
  { nombre: "Construcción", ciudades: ["Lima", "Cusco", "Arequipa", "Tarapoto"] },
  { nombre: "Comercio", ciudades: ["Lima", "Juliaca", "Iquitos", "Chiclayo"] },
  { nombre: "Servicios", ciudades: ["Lima", "Arequipa", "Cusco"] },
] as const;

const RAZON = ["S.A.C.", "E.I.R.L.", "S.R.L.", "S.A."] as const;
const NOMBRES = [
  "Andina", "del Sur", "Pacífico", "Inca", "Amazonía", "Altiplano", "Costa Verde",
  "Los Andes", "Valle Grande", "Mar Azul", "Tierra Fértil", "Norte", "Real",
  "Central", "Sol Naciente", "Cordillera", "Selva Alta", "Bahía", "Cumbre", "Aurora",
] as const;

const GIROS: Record<string, string[]> = {
  Agroindustria: ["Agroexportadora", "Procesadora", "Packing", "Fundo"],
  Manufactura: ["Industrias", "Metalúrgica", "Plásticos", "Envasadora"],
  "Textil y confecciones": ["Textiles", "Confecciones", "Hilandería", "Tejidos"],
  "Transporte y logística": ["Transportes", "Logística", "Carga", "Almacenes"],
  "Pesca y acuicultura": ["Pesquera", "Acuícola", "Conservera", "Frigorífico"],
  Construcción: ["Constructora", "Ingeniería", "Prefabricados", "Concretos"],
  Comercio: ["Distribuidora", "Comercial", "Importadora", "Mayorista"],
  Servicios: ["Servicios", "Soluciones", "Grupo", "Corporación"],
};

/** Proyecto por sector: el título tiene que sonar a lo que esa empresa
 * hace, o el catálogo entero se lee como relleno generado. */
const PROYECTOS: Record<string, { titulo: string; resumen: string; tipo: CollateralKind }[]> = {
  Agroindustria: [
    { titulo: "Planta de secado y trilla", resumen: "Secadora y trilladora para procesar la cosecha propia y de acopio.", tipo: "machinery" },
    { titulo: "Cámara de frío para exportación", resumen: "Cadena de frío para cumplir el estándar del comprador europeo.", tipo: "real_estate" },
    { titulo: "Ampliación de packing", resumen: "Segunda línea de selección y empaque para la campaña.", tipo: "machinery" },
    { titulo: "Capital para campaña de arándano", resumen: "Insumos y jornales del ciclo, contra contrato de venta firmado.", tipo: "machinery" },
  ],
  Manufactura: [
    { titulo: "Segunda línea de embotellado PET", resumen: "Línea completa para duplicar la capacidad de envasado.", tipo: "machinery" },
    { titulo: "Inyectora de alta tonelada", resumen: "Equipo para dejar de tercerizar el 40% de la producción.", tipo: "machinery" },
    { titulo: "Horno industrial de recocido", resumen: "Reemplazo del horno que limita el volumen de la planta.", tipo: "machinery" },
    { titulo: "Automatización de la línea de armado", resumen: "Celda robotizada para el cuello de botella del proceso.", tipo: "machinery" },
  ],
  "Textil y confecciones": [
    { titulo: "Compra de mercadería para temporada", resumen: "Tela e insumos del pedido ya colocado con dos clientes.", tipo: "machinery" },
    { titulo: "Máquinas de tejido circular", resumen: "Seis máquinas para atender el pedido de exportación.", tipo: "machinery" },
    { titulo: "Planta de teñido y acabado", resumen: "Acondicionamiento del local y equipos de acabado.", tipo: "real_estate" },
    { titulo: "Pedido de exportación a Chile", resumen: "Producción y logística del embarque comprometido.", tipo: "machinery" },
  ],
  "Transporte y logística": [
    { titulo: "Flota de reparto refrigerado", resumen: "Cuatro unidades con thermo para la ruta del norte.", tipo: "vehicle" },
    { titulo: "Renovación de tracto camiones", resumen: "Dos tractos para bajar el costo de mantenimiento.", tipo: "vehicle" },
    { titulo: "Almacén de consolidación", resumen: "Local propio para dejar de alquilar en el Callao.", tipo: "real_estate" },
    { titulo: "Ampliación de flota de última milla", resumen: "Ocho unidades ligeras para el contrato de reparto.", tipo: "vehicle" },
  ],
  "Pesca y acuicultura": [
    { titulo: "Planta de congelado", resumen: "Túnel de congelamiento para vender producto terminado.", tipo: "machinery" },
    { titulo: "Renovación de embarcación", resumen: "Motor y equipamiento de la embarcación principal.", tipo: "vehicle" },
    { titulo: "Jaulas para cultivo de trucha", resumen: "Módulos de jaula y alimento del primer ciclo.", tipo: "machinery" },
    { titulo: "Cámara frigorífica en muelle", resumen: "Frío en el desembarque para no rematar la pesca.", tipo: "real_estate" },
  ],
  Construcción: [
    { titulo: "Capital para obra adjudicada", resumen: "Materiales y planilla de la obra ya contratada.", tipo: "machinery" },
    { titulo: "Planta de prefabricados", resumen: "Moldes y mesa de vibrado para producir en serie.", tipo: "machinery" },
    { titulo: "Compra de excavadora", resumen: "Equipo propio para dejar de alquilar por hora.", tipo: "vehicle" },
    { titulo: "Habilitación de terreno industrial", resumen: "Obras de habilitación del terreno con partida inscrita.", tipo: "real_estate" },
  ],
  Comercio: [
    { titulo: "Compra de mercadería para campaña", resumen: "Stock de la campaña escolar, con proveedores cerrados.", tipo: "machinery" },
    { titulo: "Apertura de segundo local", resumen: "Acondicionamiento y stock inicial del local nuevo.", tipo: "real_estate" },
    { titulo: "Importación de repuestos", resumen: "Contenedor de repuestos con carta de crédito abierta.", tipo: "machinery" },
    { titulo: "Sustitución de deuda de corto plazo", resumen: "Reemplazo de financiamiento caro por uno a 12 meses.", tipo: "machinery" },
  ],
  Servicios: [
    { titulo: "Equipamiento de laboratorio", resumen: "Equipos para acreditar dos ensayos nuevos.", tipo: "machinery" },
    { titulo: "Central de datos propia", resumen: "Infraestructura para dejar de depender de un tercero.", tipo: "machinery" },
    { titulo: "Compra del local de operaciones", resumen: "Local propio con partida registral inscrita.", tipo: "real_estate" },
    { titulo: "Capital para contrato adjudicado", resumen: "Planilla y equipos del contrato de tres años.", tipo: "machinery" },
  ],
};

const HITOS: Record<CollateralKind, { title: string; description: string; releaseBps: number }[]> = {
  machinery: [
    { title: "Adelanto a proveedor", description: "30% de la orden de compra, contra factura proforma.", releaseBps: 3000 },
    { title: "Llegada e internamiento", description: "Equipo en planta, con guía de remisión.", releaseBps: 2500 },
    { title: "Instalación y montaje", description: "Acta de montaje firmada por el integrador.", releaseBps: 2500 },
    { title: "Puesta en marcha", description: "Certificado de operación y primer lote producido.", releaseBps: 2000 },
  ],
  vehicle: [
    { title: "Separación de unidades", description: "Reserva firmada con el concesionario.", releaseBps: 4000 },
    { title: "Entrega y tarjeta de propiedad", description: "Unidades inscritas a nombre de la empresa.", releaseBps: 4000 },
    { title: "Puesta en ruta", description: "Unidades operando con SOAT y GPS instalado.", releaseBps: 2000 },
  ],
  real_estate: [
    { title: "Firma de minuta", description: "Minuta firmada y arras entregadas.", releaseBps: 3000 },
    { title: "Inscripción registral", description: "Partida inscrita en SUNARP a nombre de la empresa.", releaseBps: 3000 },
    { title: "Obra e implementación", description: "Avance de obra verificado por el supervisor.", releaseBps: 2500 },
    { title: "Operación", description: "Local operando con licencia de funcionamiento.", releaseBps: 1500 },
  ],
};

const HECHOS = [
  "Contrato de venta firmado con el comprador principal",
  "Dos años consecutivos con ventas al alza",
  "Sin deuda vencida en el sistema financiero",
  "Cliente ancla con tres años de relación comercial",
  "Garantía inscrita y sin gravámenes previos",
  "Orden de compra en firme por el 60% de la producción",
  "Certificación vigente exigida por el comprador",
  "Historial de pago puntual con proveedores",
] as const;

/** Wallet determinística y reconocible: todo lo sembrado empieza en 0x5EED. */
const wallet = (i: number) => MARCA + i.toString(16).padStart(36, "0");

/** RUC de persona jurídica: 11 dígitos, prefijo 20. */
const ruc = (i: number) => `20${(100000000 + i * 7919).toString().slice(0, 9)}`;

function hash32(i: number): string {
  const r = prng(1000 + i);
  let h = "";
  for (let k = 0; k < 64; k++) h += Math.floor(r() * 16).toString(16);
  return `0x${h}`;
}

const fecha = (offsetDias: number) =>
  new Date(HOY.getTime() + offsetDias * 86_400_000).toISOString().slice(0, 10);

const usdc = (n: number) => (BigInt(Math.round(n)) * 1_000_000n).toString();

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

async function limpiar() {
  // El orden importa: opportunities referencia companies y submissions.
  await sql`
    DELETE FROM opportunities
    WHERE company_id IN (SELECT id FROM companies WHERE wallet LIKE ${MARCA + "%"})
  `;
  await sql`
    DELETE FROM submission_events
    WHERE submission_id IN (
      SELECT id FROM verifier_submissions WHERE company_wallet LIKE ${MARCA + "%"}
    )
  `;
  await sql`DELETE FROM verifier_submissions WHERE company_wallet LIKE ${MARCA + "%"}`;
  await sql`DELETE FROM companies WHERE wallet LIKE ${MARCA + "%"}`;
}

/**
 * Se genera TODO en memoria y se escribe en cuatro peticiones, una por
 * tabla, con UNNEST sobre arrays. La primera versión insertaba fila por
 * fila —unas 450 peticiones HTTP contra Neon, a 500 ms de latencia— y se
 * cortaba a la mitad por timeout, dejando el catálogo poblado a medias.
 */
type Fila = {
  compId: string;
  subId: string;
  oppId: string;
  nombre: string;
  ruc: string;
  wallet: string;
  sector: string;
  ciudad: string;
  anios: number;
  empleados: number;
  ventas: number;
  passport: string;
  titulo: string;
  resumen: string;
  monto: number;
  plazo: number;
  apyBps: number;
  kind: CollateralKind;
  tasado: number;
  hash: string;
  estadoSub: string;
  reviewer: string | null;
  reviewStartedAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  submittedAt: string;
  publicada: boolean;
  status: string;
  recaudado: number;
  inversionistas: number;
  recuperado: string | null;
  colateral: string;
  hitos: string;
  highlights: string;
  slug: string;
  aporteBps: number;
  deadline: string;
  publishedAt: string;
};

async function main() {
  const soloLimpiar = process.argv.includes("--limpiar");

  await limpiar();
  if (soloLimpiar) {
    console.log("Catálogo sembrado eliminado. Los expedientes reales quedan intactos.");
    return;
  }

  const filas: Fila[] = [];

  for (let i = 0; i < CANTIDAD + EN_COLA; i++) {
    const sector = pick(SECTORES);
    const ciudad = pick(sector.ciudades);
    const giro = pick(GIROS[sector.nombre]);
    const nombre = `${giro} ${pick(NOMBRES)} ${pick(RAZON)}`;
    const proyecto = pick(PROYECTOS[sector.nombre]);

    const plazo = pick([6, 9, 12, 18]);
    const ventas = entre(180, 3200) * 1000;
    const monto = pick([10, 15, 25, 40, 50, 75, 100, 150, 200, 250]) * 1000;
    const kind = proyecto.tipo;
    const haircut = HAIRCUT_BY_KIND[kind];
    // La cobertura se fija sobre el valor NETO recuperable y el tasado se
    // deriva de ahí, no al revés. Partiendo del tasado, un activo con 40%
    // de castigo (vehículos) daba coberturas de 0.70x: garantía que no
    // cubre el principal, o sea expedientes que ningún verificador habría
    // aprobado, sembrados como aprobados.
    const coberturaNeta = 1.15 + rnd() * 0.85;
    const tasado =
      Math.round((monto * coberturaNeta) / ((10_000 - haircut) / 10_000) / 1000) * 1000;
    const neto = Math.floor((tasado * (10_000 - haircut)) / 10_000);

    // Los últimos quedan sin publicar: la bandeja del verificador tiene
    // que tener trabajo de verdad que mostrar.
    const publicada = i < CANTIDAD;
    const estadoSub = publicada ? "approved" : rnd() < 0.4 ? "in_review" : "pending";
    const cerrados = rnd() < 0.45 ? entre(1, 4) : 0;

    // Los cuatro finales tienen que estar en pantalla, incluido el
    // default: es el diferenciador del producto, no una nota al pie.
    const dado = rnd();
    const status =
      dado < 0.55 ? "funding" : dado < 0.82 ? "active" : dado < 0.94 ? "repaid" : "defaulted";
    const avance = status === "funding" ? 0.15 + rnd() * 0.8 : 1;

    filas.push({
      compId: randomUUID(),
      subId: randomUUID(),
      oppId: randomUUID(),
      nombre,
      ruc: ruc(i),
      wallet: wallet(i),
      sector: sector.nombre,
      ciudad,
      anios: entre(2, 24),
      empleados: entre(6, 180),
      ventas,
      passport: JSON.stringify({
        tokenId: i + 1,
        issuedAt: fecha(-entre(60, 700)),
        verifiedRevenue: usdc(ventas),
        completedDeals: cerrados,
        onTimeRepayments: cerrados === 0 ? 0 : Math.max(0, cerrados * plazo - entre(0, 2)),
        lateRepayments: cerrados === 0 ? 0 : entre(0, 2),
        defaults: 0,
      }),
      titulo: proyecto.titulo,
      resumen: proyecto.resumen,
      monto,
      plazo,
      apyBps: entre(1150, 2100),
      kind,
      tasado,
      hash: hash32(i),
      estadoSub,
      reviewer: estadoSub === "pending" ? null : "Ana Quispe",
      reviewStartedAt: estadoSub === "pending" ? null : fecha(-entre(2, 40)),
      decidedAt: estadoSub === "approved" ? fecha(-entre(1, 30)) : null,
      decidedBy: estadoSub === "approved" ? "Ana Quispe" : null,
      submittedAt: fecha(-entre(5, 90)),
      publicada,
      status,
      recaudado: Math.min(monto, Math.round((monto * avance) / 100) * 100),
      inversionistas: status === "funding" ? entre(3, 40) : entre(18, 120),
      recuperado:
        status === "defaulted" ? usdc(Math.round(monto * (0.35 + rnd() * 0.4))) : null,
      colateral: JSON.stringify({
        kind,
        description: `${proyecto.titulo} — activo en garantía, tasado por perito.`,
        appraisedValue: usdc(tasado),
        haircutBps: haircut,
        netRecoverableValue: usdc(neto),
        registryEntry: `Partida ${entre(1000000, 9999999)} — SUNARP ${ciudad}`,
        titleVerified: rnd() < 0.85,
        liens: rnd() < 0.18 ? ["Hipoteca de primer rango a favor de banco local"] : [],
      }),
      hitos: JSON.stringify(
        HITOS[kind].map((h, index) => ({
          index,
          title: h.title,
          description: h.description,
          releaseBps: h.releaseBps,
          status:
            status === "funding"
              ? "pending"
              : status === "active"
                ? index === 0
                  ? "released"
                  : index === 1
                    ? "submitted"
                    : "pending"
                : status === "repaid"
                  ? "released"
                  : index === 0
                    ? "released"
                    : "pending",
        })),
      ),
      highlights: JSON.stringify([...new Set([pick(HECHOS), pick(HECHOS), pick(HECHOS)])]),
      slug: `${slugify(proyecto.titulo)}-${i}`,
      aporteBps: entre(10, 35) * 100,
      deadline: status === "funding" ? fecha(entre(5, 60)) : fecha(-entre(10, 120)),
      publishedAt: fecha(-entre(1, 120)),
    });
  }

  const pub = filas.filter((f) => f.publicada);
  const col = <K extends keyof Fila>(k: K, xs: Fila[] = filas) => xs.map((f) => f[k]);

  await sql`
    INSERT INTO companies (id, ruc, wallet, name, sector, city, years_operating, employees, passport)
    SELECT id, ruc, wallet, name, sector, city, years, empleados, passport::jsonb
    FROM UNNEST(
      ${col("compId", pub)}::uuid[], ${col("ruc", pub)}::text[], ${col("wallet", pub)}::text[],
      ${col("nombre", pub)}::text[], ${col("sector", pub)}::text[], ${col("ciudad", pub)}::text[],
      ${col("anios", pub)}::int[], ${col("empleados", pub)}::int[], ${col("passport", pub)}::text[]
    ) AS t(id, ruc, wallet, name, sector, city, years, empleados, passport)
    ON CONFLICT (ruc) DO NOTHING
  `;

  await sql`
    INSERT INTO verifier_submissions (
      id, company_name, company_ruc, company_wallet, sector, city, years_operating,
      annual_revenue, project_title, project_type, use_of_funds, requested_amount,
      term_months, collateral_kind, collateral_value, collateral_detail,
      legal_pack_hash, legal_pack_name, status, reviewer, review_started_at,
      decided_at, decided_by, submitted_at)
    SELECT id, nombre, ruc, wallet, sector, city, years, ventas, titulo, 'machinery',
           resumen, monto, plazo, kind, tasado, detalle,
           hash, 'expediente-legal.pdf', estado, reviewer, revisado::timestamptz,
           decidido::timestamptz, decidedby, enviado::timestamptz
    FROM UNNEST(
      ${col("subId")}::uuid[], ${col("nombre")}::text[], ${col("ruc")}::text[],
      ${col("wallet")}::text[], ${col("sector")}::text[], ${col("ciudad")}::text[],
      ${col("anios")}::int[], ${filas.map((f) => String(f.ventas))}::text[],
      ${col("titulo")}::text[], ${col("resumen")}::text[],
      ${filas.map((f) => String(f.monto))}::text[], ${col("plazo")}::int[],
      ${col("kind")}::text[], ${filas.map((f) => String(f.tasado))}::text[],
      ${filas.map((f) => `${f.titulo}. Garantía inscrita en registro público.`)}::text[],
      ${col("hash")}::text[], ${col("estadoSub")}::text[], ${col("reviewer")}::text[],
      ${col("reviewStartedAt")}::text[], ${col("decidedAt")}::text[],
      ${col("decidedBy")}::text[], ${col("submittedAt")}::text[]
    ) AS t(id, nombre, ruc, wallet, sector, city, years, ventas, titulo, resumen,
           monto, plazo, kind, tasado, detalle, hash, estado, reviewer, revisado,
           decidido, decidedby, enviado)
  `;

  // La bitácora: enviado siempre, tomado si alguien lo revisó, aprobado
  // si se decidió, publicado si salió al catálogo.
  const ev: { sub: string; kind: string; actor: string; rol: string }[] = [];
  for (const f of filas) {
    ev.push({ sub: f.subId, kind: "submitted", actor: f.wallet, rol: "business" });
    if (f.estadoSub !== "pending")
      ev.push({ sub: f.subId, kind: "claimed", actor: "Ana Quispe", rol: "verifier" });
    if (f.estadoSub === "approved")
      ev.push({ sub: f.subId, kind: "approved", actor: "Ana Quispe", rol: "verifier" });
    if (f.publicada)
      ev.push({ sub: f.subId, kind: "published", actor: "Ana Quispe", rol: "verifier" });
  }

  await sql`
    INSERT INTO submission_events (submission_id, kind, actor, actor_role)
    SELECT sub, kind, actor, rol
    FROM UNNEST(
      ${ev.map((e) => e.sub)}::uuid[], ${ev.map((e) => e.kind)}::text[],
      ${ev.map((e) => e.actor)}::text[], ${ev.map((e) => e.rol)}::text[]
    ) AS t(sub, kind, actor, rol)
  `;

  await sql`
    INSERT INTO opportunities (
      id, slug, company_id, submission_id, project_title, summary, highlights,
      target_amount, raised_amount, borrower_contribution_bps, term_months, apy_bps,
      status, collateral, milestones, legal_pack_hash, funding_deadline,
      investor_count, recovered_amount, published_at)
    SELECT id, slug, comp, sub, titulo, resumen, highlights::jsonb,
           objetivo, recaudado, aporte, plazo, apy, status,
           colateral::jsonb, hitos::jsonb, hash, cierre::date,
           inversionistas, recuperado, publicado::timestamptz
    FROM UNNEST(
      ${col("oppId", pub)}::uuid[], ${col("slug", pub)}::text[], ${col("compId", pub)}::uuid[],
      ${col("subId", pub)}::uuid[], ${col("titulo", pub)}::text[], ${col("resumen", pub)}::text[],
      ${col("highlights", pub)}::text[], ${pub.map((f) => usdc(f.monto))}::text[],
      ${pub.map((f) => usdc(f.recaudado))}::text[], ${col("aporteBps", pub)}::int[],
      ${col("plazo", pub)}::int[], ${col("apyBps", pub)}::int[], ${col("status", pub)}::text[],
      ${col("colateral", pub)}::text[], ${col("hitos", pub)}::text[], ${col("hash", pub)}::text[],
      ${col("deadline", pub)}::text[], ${col("inversionistas", pub)}::int[],
      ${col("recuperado", pub)}::text[], ${col("publishedAt", pub)}::text[]
    ) AS t(id, slug, comp, sub, titulo, resumen, highlights, objetivo, recaudado,
           aporte, plazo, apy, status, colateral, hitos, hash, cierre,
           inversionistas, recuperado, publicado)
  `;

  const [{ n: total }] = (await sql`SELECT count(*)::int AS n FROM opportunities`) as {
    n: number;
  }[];
  const porEstado = (await sql`
    SELECT status, count(*)::int AS n FROM opportunities GROUP BY status ORDER BY n DESC
  `) as { status: string; n: number }[];
  const [{ n: cola }] = (await sql`
    SELECT count(*)::int AS n FROM verifier_submissions WHERE status IN ('pending','in_review')
  `) as { n: number }[];

  console.log(
    `Sembradas ${pub.length} oportunidades publicadas y ${filas.length - pub.length} expedientes en cola.`,
  );
  console.log("Catálogo:", porEstado.map((r) => `${r.status}=${r.n}`).join(" · "));
  console.log("Total publicado:", total, "| en cola del verificador:", cola);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
