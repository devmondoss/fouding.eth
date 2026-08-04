/** Selectores derivados. Nunca se guarda lo que se puede calcular. */

import type { Milestone, Opportunity, OpportunityStatus } from "./types";

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

// ------------------------------------------------------------ etiquetas

export const STATUS_LABEL: Record<OpportunityStatus, string> = {
  review: "En revisión",
  funding: "En fondeo",
  active: "Activa",
  repaid: "Pagada",
  defaulted: "En default",
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
