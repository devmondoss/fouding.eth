/**
 * Representación de transporte de una oportunidad.
 *
 * El modelo de dominio (lib/types.ts) usa `bigint` para todo monto — es la
 * decisión que permite que las cifras del prototipo sean idénticas a las
 * del contrato. Pero `JSON.stringify` lanza sobre un bigint, así que entre
 * el servidor y el navegador los montos viajan como STRING decimal y se
 * reconstruyen del otro lado.
 *
 * Esta misma forma es la que se guarda en las columnas JSONB, así que la
 * fila de Postgres y la respuesta HTTP tienen la misma estructura y no hay
 * dos conversiones distintas que mantener sincronizadas.
 */

import type {
  Collateral,
  Company,
  Milestone,
  Opportunity,
  Passport,
} from "../types";

export type WirePassport = Omit<Passport, "verifiedRevenue"> & {
  verifiedRevenue: string;
};

export type WireCompany = Omit<Company, "passport"> & {
  passport: WirePassport;
};

export type WireCollateral = Omit<
  Collateral,
  "appraisedValue" | "netRecoverableValue"
> & {
  appraisedValue: string;
  netRecoverableValue: string;
};

export type WireOpportunity = Omit<
  Opportunity,
  | "company"
  | "collateral"
  | "targetAmount"
  | "raisedAmount"
  | "recoveredAmount"
> & {
  company: WireCompany;
  collateral: WireCollateral;
  targetAmount: string;
  raisedAmount: string;
  recoveredAmount: string | null;
  /** Vault del protocolo que liquida esta oportunidad. Null mientras no
   * se haya desplegado — ver scripts de packages/stylus. */
  vaultAddress: string | null;
};

export function opportunityToWire(o: Opportunity): WireOpportunity {
  return {
    ...o,
    targetAmount: o.targetAmount.toString(),
    raisedAmount: o.raisedAmount.toString(),
    recoveredAmount: o.recoveredAmount != null ? o.recoveredAmount.toString() : null,
    vaultAddress: null,
    company: {
      ...o.company,
      passport: {
        ...o.company.passport,
        verifiedRevenue: o.company.passport.verifiedRevenue.toString(),
      },
    },
    collateral: {
      ...o.collateral,
      appraisedValue: o.collateral.appraisedValue.toString(),
      netRecoverableValue: o.collateral.netRecoverableValue.toString(),
    },
  };
}

export function opportunityFromWire(w: WireOpportunity): Opportunity {
  return {
    id: w.id,
    slug: w.slug,
    projectTitle: w.projectTitle,
    summary: w.summary,
    highlights: w.highlights,
    targetAmount: BigInt(w.targetAmount),
    raisedAmount: BigInt(w.raisedAmount),
    borrowerContributionBps: w.borrowerContributionBps,
    termMonths: w.termMonths,
    apyBps: w.apyBps,
    status: w.status,
    milestones: w.milestones as Milestone[],
    legalPackHash: w.legalPackHash,
    fundingDeadline: w.fundingDeadline,
    investorCount: w.investorCount,
    ...(w.recoveredAmount != null
      ? { recoveredAmount: BigInt(w.recoveredAmount) }
      : {}),
    company: {
      ...w.company,
      passport: {
        ...w.company.passport,
        verifiedRevenue: BigInt(w.company.passport.verifiedRevenue),
      },
    },
    collateral: {
      ...w.collateral,
      appraisedValue: BigInt(w.collateral.appraisedValue),
      netRecoverableValue: BigInt(w.collateral.netRecoverableValue),
    },
  };
}
