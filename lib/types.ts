/**
 * Modelo de dominio. Se define UNA vez, con la forma que van a tener los
 * contratos. Ver build-plan.md §Fase 2.
 *
 * Convenciones que no se negocian:
 *   - Montos en bigint, micro-USDC (6 decimales). 1_500_000_000n = 1,500 USDC.
 *   - Tasas y porcentajes en basis points. 14.5% = 1450 bps.
 */

export type CollateralKind = "machinery" | "vehicle" | "real_estate";

export type OpportunityStatus =
  | "review" // expediente en revisión del verificador
  | "funding" // publicada, recibiendo capital
  | "active" // fondeada, ejecutando hitos
  | "repaid" // pagada por completo
  | "defaulted"; // incumplimiento, en liquidación

export type MilestoneStatus =
  | "pending" // aún no presentado
  | "submitted" // empresa subió evidencia, espera verificador
  | "released" // aprobado y desembolsado
  | "rejected";

/**
 * Pasaporte de negocio: soulbound (ERC-5192), nunca transferible.
 * Es identidad y reputación. Si se pudiera vender, una empresa con mal
 * historial compraría el historial de una buena.
 */
export type Passport = {
  tokenId: number;
  issuedAt: string;
  verifiedRevenue: bigint; // ventas anuales validadas contra SUNAT
  completedDeals: number;
  onTimeRepayments: number;
  lateRepayments: number;
  defaults: number;
};

export type Company = {
  id: string;
  name: string;
  ruc: string;
  sector: string;
  city: string;
  yearsOperating: number;
  employees: number;
  passport: Passport;
};

export type Collateral = {
  kind: CollateralKind;
  description: string;
  appraisedValue: bigint; // tasación — referencia, NO criterio de decisión
  haircutBps: number; // castigo por clase de activo
  netRecoverableValue: bigint; // lo único que importa para el crédito
  registryEntry: string | null; // partida registral pública (SUNARP)
  titleVerified: boolean;
  liens: string[]; // gravámenes previos
};

export type Milestone = {
  index: number;
  title: string;
  description: string;
  releaseBps: number; // % del capital que libera este hito
  status: MilestoneStatus;
  evidenceName?: string;
  evidenceHash?: string;
  releasedAt?: string;
};

export type Opportunity = {
  id: string;
  slug: string;
  company: Company;
  projectTitle: string;
  summary: string;
  /** Hechos verificables del proyecto, no cifras. Es lo que da contexto. */
  highlights: string[];

  targetAmount: bigint;
  raisedAmount: bigint;
  borrowerContributionBps: number; // aporte propio: skin in the game
  termMonths: number;
  apyBps: number;

  status: OpportunityStatus;
  collateral: Collateral;
  milestones: Milestone[];

  legalPackHash: string; // keccak256 del paquete legal
  fundingDeadline: string;
  investorCount: number;

  recoveredAmount?: bigint; // solo si hubo default y liquidación
};

/** Posición del inversionista: ERC-20 transferible SOLO entre wallets verificadas. */
export type Position = {
  id: string;
  opportunitySlug: string;
  principal: bigint;
  investedAt: string;
  listedPrice: bigint | null; // si está publicada en el libro de órdenes
};

export type Grade = "A" | "B" | "C" | "D" | "E";

/** Registro de actividad de la cuenta del inversionista. */
export type ActivityKind =
  | "invest" // aporté capital
  | "release" // se liberó un hito del deal
  | "repayment" // recibí un pago
  | "default" // el deal entró en incumplimiento
  | "recovery" // se distribuyó el recupero
  | "listing" // publiqué mi posición en venta
  | "deposit"; // agregué fondos a la cuenta

export type ActivityEvent = {
  id: string;
  at: string;
  kind: ActivityKind;
  /** null para movimientos de cuenta sin operación asociada (depósitos). */
  opportunitySlug: string | null;
  title: string;
  detail: string;
  amount: bigint | null;
  /** Signo respecto del saldo del inversionista. */
  direction: "in" | "out" | "none";
};

/** Haircut por clase de activo. Cuanto menos líquido, mayor castigo. */
export const HAIRCUT_BY_KIND: Record<CollateralKind, number> = {
  real_estate: 3000,
  machinery: 3500,
  vehicle: 4000,
};
