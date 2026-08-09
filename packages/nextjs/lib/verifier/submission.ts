import type { CollateralKind } from "@/lib/types";
import type {
  SubmissionEvent,
  SubmissionEventKind,
  SubmissionStatus,
} from "./types";

/**
 * Reglas y catálogos del expediente. Vive fuera de store.ts (que es
 * `server-only`) porque el formulario, la API y el panel del verificador
 * tienen que validar contra lo MISMO: si el mínimo de 10 000 USDC solo
 * existiera en el cliente, un POST directo lo saltaría, y si solo
 * existiera en el servidor la empresa se enteraría recién al enviar.
 */

/** Piso de originación: por debajo de esto el costo de revisar, tasar y
 * publicar una operación se come el retorno de todos. */
export const MIN_REQUESTED_USDC = 10_000;
export const MAX_REQUESTED_USDC = 1_000_000;

/** Años de operación mínimos — criterio de elegibilidad, no un capricho
 * del formulario (ver PRODUCT.md §Users: "≥2 años de operación"). */
export const MIN_YEARS_OPERATING = 2;

/** Lo que la plataforma se compromete a responder. Se muestra en el
 * expediente enviado para que "en revisión" tenga un horizonte. */
export const REVIEW_SLA_DAYS = 3;

export const AMOUNT_PRESETS = [10_000, 25_000, 50_000, 100_000, 250_000];

export const TERM_PRESETS = [6, 9, 12, 18];

export type ProjectType = {
  key: string;
  label: string;
  detail: string;
};

/** Para qué se pide el capital. No es taxonomía decorativa: el tipo
 * condiciona el cronograma de hitos que arma el verificador al publicar. */
export const PROJECT_TYPES: ProjectType[] = [
  {
    key: "inventory",
    label: "Compra de mercadería o insumos",
    detail: "Stock para una temporada o un contrato ya cerrado",
  },
  {
    key: "machinery",
    label: "Maquinaria y equipamiento",
    detail: "Compra, importación o repotenciación de equipos",
  },
  {
    key: "expansion",
    label: "Ampliación de planta o local",
    detail: "Obra civil, acondicionamiento o un local nuevo",
  },
  {
    key: "contract",
    label: "Ejecución de contrato adjudicado",
    detail: "Capital de trabajo contra una orden de compra firmada",
  },
  {
    key: "export",
    label: "Pedido de exportación",
    detail: "Producción y logística de un embarque comprometido",
  },
  {
    key: "refinance",
    label: "Sustitución de deuda cara",
    detail: "Reemplazar financiamiento de corto plazo más caro",
  },
];

export const PROJECT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  PROJECT_TYPES.map((t) => [t.key, t.label]),
);

export const SECTORS = [
  "Manufactura",
  "Agroindustria",
  "Comercio",
  "Construcción",
  "Transporte y logística",
  "Servicios",
  "Textil y confecciones",
  "Pesca y acuicultura",
];

/** Mismos tres tipos que acepta el colateral de una oportunidad
 * (lib/types.ts) — la empresa declara cuál ofrece y el verificador lo
 * tasa después. Que las claves coincidan es lo que permite que el
 * formulario de publicación llegue prellenado. */
export const COLLATERAL_LABEL: Record<CollateralKind, string> = {
  machinery: "Maquinaria o equipo",
  vehicle: "Vehículo o flota",
  real_estate: "Inmueble",
};

export const COLLATERAL_DETAIL: Record<CollateralKind, string> = {
  machinery: "Se inscribe como garantía mobiliaria en SUNARP",
  vehicle: "Se inscribe en el registro vehicular",
  real_estate: "Se inscribe como hipoteca en el registro de predios",
};

export const COLLATERAL_KINDS = Object.keys(COLLATERAL_LABEL) as CollateralKind[];

/* ── Validación ───────────────────────────────────────────────────── */

/** Solo dígitos, sin separadores ni espacios. */
export function digits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Lo que se teclea como monto ("50 000", "50,000") a número. */
export function parseAmount(value: string): number {
  const cleaned = value.replace(/[^\d.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * RUC peruano: 11 dígitos y prefijo válido. 20 es persona jurídica —lo
 * normal acá—, 10 es persona natural con negocio, y 15/17 son formas
 * antiguas que siguen vigentes. Se valida el prefijo y no solo el largo
 * porque un RUC con prefijo inválido no existe en SUNAT, y el verificador
 * lo iba a rebotar igual una semana después.
 */
export function rucError(value: string): string | null {
  const d = digits(value);
  if (!d) return "El RUC es obligatorio";
  if (d.length !== 11) return "El RUC tiene 11 dígitos";
  if (!["10", "15", "17", "20"].includes(d.slice(0, 2))) {
    return "Un RUC empieza en 10, 15, 17 o 20";
  }
  return null;
}

export function amountError(value: string): string | null {
  const n = parseAmount(value);
  if (!Number.isFinite(n) || n <= 0) return "Ingresa un monto";
  if (n < MIN_REQUESTED_USDC) {
    return `El mínimo es ${formatUsdcPlain(MIN_REQUESTED_USDC)} USDC`;
  }
  if (n > MAX_REQUESTED_USDC) {
    return `Por encima de ${formatUsdcPlain(MAX_REQUESTED_USDC)} USDC la operación se estructura caso por caso — escríbenos`;
  }
  return null;
}

export function yearsError(value: string): string | null {
  const n = Number(digits(value));
  if (!value.trim()) return "Cuántos años lleva operando";
  if (!Number.isFinite(n)) return "Ingresa un número de años";
  if (n < MIN_YEARS_OPERATING) {
    return `Founding financia empresas con al menos ${MIN_YEARS_OPERATING} años de operación`;
  }
  return null;
}

/* ── Presentación ─────────────────────────────────────────────────── */

const nf = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });

export function formatUsdcPlain(value: number | string): string {
  const n = typeof value === "string" ? parseAmount(value) : value;
  return Number.isFinite(n) ? nf.format(n) : "—";
}

/** Referencia corta y legible del expediente, derivada del UUID. Existe
 * para que empresa y verificador puedan nombrar el mismo papel por
 * teléfono sin dictar 36 caracteres. */
export function folio(id: string): string {
  return `EXP-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

/**
 * Cobertura declarada: cuántas veces el valor de la garantía cubre lo
 * pedido. Es una referencia previa a la tasación — el número que decide
 * es el valor neto recuperable, que sale recién con el haircut del
 * verificador (docs/start.md §Cobertura).
 */
export function declaredCoverage(
  collateralValue: string,
  requestedAmount: string,
): number | null {
  const c = parseAmount(collateralValue);
  const r = parseAmount(requestedAmount);
  if (!Number.isFinite(c) || !Number.isFinite(r) || r <= 0 || c <= 0) return null;
  return c / r;
}

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: "En cola",
  in_review: "En revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export const STATUS_TONE: Record<
  SubmissionStatus,
  "neutral" | "brand" | "warning" | "positive" | "negative"
> = {
  pending: "neutral",
  in_review: "warning",
  approved: "positive",
  rejected: "negative",
};

/**
 * Qué sigue, en segunda persona. Una línea cada uno: esto se lee en la
 * tarjeta del panel y otra vez en el expediente abierto, así que un
 * párrafo largo aparecía dos veces en la misma pantalla. Lo que la
 * empresa vino a saber es en qué punto está y si le toca hacer algo.
 */
export const NEXT_STEP: Record<SubmissionStatus, string> = {
  pending: `En cola de revisión. Un verificador lo toma y te responde en un máximo de ${REVIEW_SLA_DAYS} días hábiles.`,
  in_review: "Un verificador lo está revisando. Si le falta un documento, te lo pide acá mismo.",
  approved:
    "Tu wallet quedó habilitada. Falta que el verificador fije plazo, rentabilidad e hitos para publicarlo.",
  rejected: "No pasó la revisión. Corrige lo observado y envía una solicitud nueva.",
};

export const EVENT_LABEL: Record<SubmissionEventKind, string> = {
  submitted: "Expediente enviado",
  claimed: "Tomado por un verificador",
  approved: "Aprobado",
  rejected: "Rechazado",
  published: "Publicado en el catálogo",
};

/** Quién hizo la acción, dicho para la empresa (no "actor_role"). */
export const EVENT_ACTOR_LABEL: Record<SubmissionEvent["actorRole"], string> = {
  business: "Tu empresa",
  verifier: "Verificador",
  system: "Plataforma",
};
