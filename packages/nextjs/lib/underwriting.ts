/**
 * Motor de underwriting y cascada de pagos.
 *
 * Funciones PURAS y deterministas: mismos datos -> mismo resultado. Esto es
 * a propósito. Es la lógica que después se porta al contrato (candidata a
 * Stylus, ver docs/conceptos-y-cambios.md §Parte 5), así que no puede depender
 * de nada externo ni de la fecha actual.
 */

import type { Grade, Opportunity } from "./types";
import { coverageBps, creditInterest, expectedInterest } from "./opportunity";

// ---------------------------------------------------------------- SCORING

export type ScoreFactor = {
  key: string;
  label: string;
  points: number;
  max: number;
  detail: string;
};

export type ScoreResult = {
  score: number; // 0..1000
  grade: Grade;
  factors: ScoreFactor[];
  suggestedApyBps: number;
};

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export function computeScore(o: Opportunity): ScoreResult {
  const factors: ScoreFactor[] = [];

  // 1. Antigüedad — satura a los 10 años.
  const yrs = clamp(o.company.yearsOperating / 10, 0, 1);
  factors.push({
    key: "tenure",
    label: "Antigüedad operativa",
    points: Math.round(yrs * 150),
    max: 150,
    detail: `${o.company.yearsOperating} años de operación`,
  });

  // 2. Ventas verificadas contra el monto pedido. 6x o más es holgado.
  const revenueMultiple =
    o.targetAmount > 0n
      ? Number(o.company.passport.verifiedRevenue) / Number(o.targetAmount)
      : 0;
  factors.push({
    key: "revenue",
    label: "Ventas sobre monto solicitado",
    points: Math.round(clamp(revenueMultiple / 6, 0, 1) * 250),
    max: 250,
    detail: `${revenueMultiple.toFixed(1)}x ventas anuales verificadas`,
  });

  // 3. Cobertura de garantía. Contra valor NETO recuperable, nunca tasación.
  const cov = coverageBps(o);
  factors.push({
    key: "coverage",
    label: "Cobertura de garantía",
    points: Math.round(clamp(cov / 16000, 0, 1) * 250),
    max: 250,
    detail: `${(cov / 10000).toFixed(2)}x sobre valor neto recuperable`,
  });

  // 4. Aporte propio: cuánto pierde la empresa si el proyecto fracasa.
  factors.push({
    key: "skin",
    label: "Aporte propio",
    points: Math.round(clamp(o.borrowerContributionBps / 3000, 0, 1) * 150),
    max: 150,
    detail: `${(o.borrowerContributionBps / 100).toFixed(0)}% del costo del proyecto`,
  });

  // 5. Historial del pasaporte. Sin historial: mitad de puntaje, no cero.
  const p = o.company.passport;
  const totalRepayments = p.onTimeRepayments + p.lateRepayments;
  let historyRatio = 0.5;
  if (totalRepayments > 0) {
    historyRatio =
      (p.onTimeRepayments - p.lateRepayments * 0.5 - p.defaults * 3) /
      totalRepayments;
  }
  factors.push({
    key: "history",
    label: "Historial de pago",
    points: Math.round(clamp(historyRatio, 0, 1) * 200),
    max: 200,
    detail: totalRepayments
      ? `${p.onTimeRepayments} a tiempo · ${p.lateRepayments} tardíos · ${p.defaults} default`
      : "Sin historial previo en la plataforma",
  });

  const score = factors.reduce((sum, f) => sum + f.points, 0);

  return { score, grade: gradeOf(score), factors, suggestedApyBps: suggestedApy(score) };
}

export function gradeOf(score: number): Grade {
  if (score >= 800) return "A";
  if (score >= 680) return "B";
  if (score >= 560) return "C";
  if (score >= 440) return "D";
  return "E";
}

/** Mejor score -> menor tasa. Rango 13% .. 22%, redondeado a 25 bps. */
export function suggestedApy(score: number): number {
  const raw = 2200 - (clamp(score, 0, 1000) / 1000) * 900;
  return Math.round(raw / 25) * 25;
}

export const GRADE_COLOR: Record<Grade, string> = {
  A: "var(--positive)",
  B: "var(--brand-ink)",
  C: "var(--warning)",
  D: "var(--warning)",
  E: "var(--negative)",
};

// -------------------------------------------------------------- WATERFALL

export type WaterfallTier = {
  order: number;
  label: string;
  due: bigint;
  paid: bigint;
  note: string;
};

export type WaterfallResult = {
  tiers: WaterfallTier[];
  surplus: bigint;
  investorRecoveryBps: number; // cuánto recupera el inversionista, en bps
};

/**
 * Cascada de distribución en caso de default. Orden fijo, definido en
 * start.md: costos legales -> servicing -> principal -> intereses -> residual.
 * Se asigna secuencialmente hasta agotar lo recuperado.
 */
export function computeWaterfall(
  recovered: bigint,
  input: {
    legalCosts: bigint;
    servicingFee: bigint;
    principal: bigint;
    interest: bigint;
  },
): WaterfallResult {
  let left = recovered;

  const take = (due: bigint): bigint => {
    const paid = left >= due ? due : left;
    left -= paid;
    return paid;
  };

  const tiers: WaterfallTier[] = [
    {
      order: 1,
      label: "Costos legales y de liquidación",
      due: input.legalCosts,
      paid: take(input.legalCosts),
      note: "Ejecución de la garantía por el vehículo legal",
    },
    {
      order: 2,
      label: "Fee de servicing",
      due: input.servicingFee,
      paid: take(input.servicingFee),
      note: "Administración pactada de antemano",
    },
    {
      order: 3,
      label: "Principal a inversionistas",
      due: input.principal,
      paid: take(input.principal),
      note: "Devolución proporcional del capital",
    },
    {
      order: 4,
      label: "Intereses a inversionistas",
      due: input.interest,
      paid: take(input.interest),
      note: "Solo si el recupero alcanza",
    },
  ];

  const investorDue = input.principal + input.interest;
  const investorPaid = tiers[2].paid + tiers[3].paid;

  return {
    tiers,
    surplus: left,
    investorRecoveryBps:
      investorDue > 0n ? Number((investorPaid * 10000n) / investorDue) : 0,
  };
}

/** Supuestos de costos usados en el prototipo, en % del principal. */
export const DEFAULT_COSTS = {
  legalBps: 600, // 6% costos de ejecución
  servicingBps: 150, // 1.5% servicing pendiente
};

export function waterfallForOpportunity(
  o: Opportunity,
  recovered: bigint,
): WaterfallResult {
  const principal = o.raisedAmount;
  return computeWaterfall(recovered, {
    legalCosts: (principal * BigInt(DEFAULT_COSTS.legalBps)) / 10000n,
    servicingFee: (principal * BigInt(DEFAULT_COSTS.servicingBps)) / 10000n,
    principal,
    interest: expectedInterest(o),
  });
}

/**
 * El escenario malo, en números: la empresa no paga, se ejecuta la
 * garantía por su valor neto recuperable y se reparte por la cascada.
 * Devuelve qué fracción de (capital + interés) le vuelve al inversionista.
 *
 * Se calcula sobre la META y no sobre lo recaudado hasta ahora: describe
 * el crédito, no el minuto de fondeo en que se lo está mirando. Con la
 * operación al 18% fondeada, usar lo recaudado daría recupero perfecto
 * —una garantía dimensionada para 150,000 sobra para 27,700— y esa cifra
 * halagüeña se evaporaría sola conforme entrara el resto del capital.
 *
 * Es la pregunta que la ficha no respondía en ningún lado: cuánto pierdo
 * si esto sale mal. Una cobertura de 1.53x la insinúa; esto la contesta,
 * ya descontados los costos de ejecución y el servicing.
 */
/** Lo que la ejecución tiene que cubrir antes de que sobre un centavo
 *  para el inversionista, más su capital e interés. */
function totalACubrir(o: Opportunity): bigint {
  const principal = o.targetAmount;
  return (
    (principal * BigInt(DEFAULT_COSTS.legalBps)) / 10000n +
    (principal * BigInt(DEFAULT_COSTS.servicingBps)) / 10000n +
    principal +
    creditInterest(o)
  );
}

/**
 * El colchón: cuánto puede caer el valor neto de la garantía antes de que
 * el inversionista deje de recuperar todo.
 *
 * Cuando la cobertura alcanza, decir "recuperas 1,063 de 1,063" hace
 * parecer que el default no cuesta nada — y de paso repite la cifra del
 * escenario bueno, que se lee como un error de cálculo. Lo que informa
 * ahí es cuánto margen hay: un activo tasado puede venderse por menos, y
 * este número dice cuánto menos aguanta la operación.
 *
 * 0 significa que ya no hay colchón: la garantía no alcanza ni en el
 * escenario en que se vende a su valor neto estimado.
 */
export function lossBufferBps(o: Opportunity): number {
  const neto = o.collateral.netRecoverableValue;
  const necesario = totalACubrir(o);
  if (o.targetAmount === 0n || neto <= necesario) return 0;
  return Number(((neto - necesario) * 10000n) / neto);
}

export function recoveryOnDefaultBps(o: Opportunity): number {
  const principal = o.targetAmount;
  if (principal === 0n) return 0;
  return computeWaterfall(o.collateral.netRecoverableValue, {
    legalCosts: (principal * BigInt(DEFAULT_COSTS.legalBps)) / 10000n,
    servicingFee: (principal * BigInt(DEFAULT_COSTS.servicingBps)) / 10000n,
    principal,
    interest: creditInterest(o),
  }).investorRecoveryBps;
}
