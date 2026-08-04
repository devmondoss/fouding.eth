/** Selectores derivados. Nunca se guarda lo que se puede calcular. */

import type { Milestone, Opportunity, OpportunityStatus, Passport } from "./types";

/** Cobertura sobre valor NETO recuperable, jamás sobre la tasación. */
export function coverageBps(o: Opportunity): number {
  if (o.targetAmount === 0n) return 0;
  return Number((o.collateral.netRecoverableValue * 10000n) / o.targetAmount);
}

export function fundingBps(o: Opportunity): number {
  if (o.targetAmount === 0n) return 0;
  return Number((o.raisedAmount * 10000n) / o.targetAmount);
}

export function releasedBps(o: Opportunity): number {
  return o.milestones
    .filter((m) => m.status === "released")
    .reduce((sum, m) => sum + m.releaseBps, 0);
}

export function releasedAmount(o: Opportunity): bigint {
  return (o.raisedAmount * BigInt(releasedBps(o))) / 10000n;
}

/** Lo que sigue encerrado en el contrato. Es la cifra clave de la demo. */
export function escrowAmount(o: Opportunity): bigint {
  return o.raisedAmount - releasedAmount(o);
}

/** Interés simple por el plazo completo. */
export function expectedInterest(o: Opportunity): bigint {
  return (
    (o.raisedAmount * BigInt(o.apyBps) * BigInt(o.termMonths)) / 10000n / 12n
  );
}

export function totalDue(o: Opportunity): bigint {
  return o.raisedAmount + expectedInterest(o);
}

/** Retorno de un ticket concreto si todo va bien. */
export function projectedReturn(o: Opportunity, amount: bigint): bigint {
  return (amount * BigInt(o.apyBps) * BigInt(o.termMonths)) / 10000n / 12n;
}

export function remainingToFund(o: Opportunity): bigint {
  const left = o.targetAmount - o.raisedAmount;
  return left > 0n ? left : 0n;
}

export function nextMilestone(o: Opportunity): Milestone | null {
  return o.milestones.find((m) => m.status !== "released") ?? null;
}

export function isOpenForFunding(o: Opportunity): boolean {
  return o.status === "funding" && remainingToFund(o) > 0n;
}

/** Resumen legible del historial del emisor: lo primero que un
 * inversionista quiere saber y lo que menos visible estaba. */
export type IssuerTrackRecord = {
  firstTime: boolean;
  label: string;
  tone: "neutral" | "positive" | "warning" | "negative";
};

export function issuerTrackRecord(p: Passport): IssuerTrackRecord {
  if (p.completedDeals === 0) {
    return {
      firstTime: true,
      label: "Primera vez en la plataforma",
      tone: "neutral",
    };
  }
  const deals = `${p.completedDeals} crédito${p.completedDeals === 1 ? "" : "s"} previo${p.completedDeals === 1 ? "" : "s"}`;
  if (p.defaults > 0) {
    return {
      firstTime: false,
      label: `Recurrente · ${deals} · ${p.defaults} en default`,
      tone: "negative",
    };
  }
  if (p.lateRepayments > 0) {
    return {
      firstTime: false,
      label: `Recurrente · ${deals} · ${p.lateRepayments} pago(s) tardío(s)`,
      tone: "warning",
    };
  }
  return {
    firstTime: false,
    label: `Recurrente · ${deals} · todos pagados a tiempo`,
    tone: "positive",
  };
}

// ------------------------------------------------------------ etiquetas

export const STATUS_LABEL: Record<OpportunityStatus, string> = {
  review: "En revisión",
  funding: "En fondeo",
  active: "Activa",
  repaid: "Pagada",
  defaulted: "En default",
};

/** Una línea que explica qué implica cada estado para el dinero del
 * inversionista — no debería haber que adivinarlo. */
export const STATUS_HELP: Record<OpportunityStatus, string> = {
  review: "Expediente en verificación. Todavía no recibe capital.",
  funding: "Levantando capital de inversionistas. Aún puedes invertir.",
  active:
    "Ya fondeada: el capital se libera por hitos verificados y genera repago.",
  repaid: "Pagada por completo. El ciclo de esta operación terminó.",
  defaulted: "Incumplimiento. La garantía está en proceso de ejecución.",
};

// El color de cada estado lo resuelve el componente Pill (STATUS_TONE).

export const COLLATERAL_LABEL = {
  machinery: "Maquinaria",
  vehicle: "Vehículo",
  real_estate: "Inmueble",
} as const;

export const MILESTONE_LABEL = {
  pending: "Pendiente",
  submitted: "Por aprobar",
  released: "Desembolsado",
  rejected: "Rechazado",
} as const;
