"use client";

/**
 * Adaptador de datos — implementación MOCK, alcance INVERSIONISTA.
 *
 * Las pantallas nunca leen datos directamente: consumen esta interfaz.
 * Cuando llegue Arbitrum se escribe un adaptador `onchain/` con la MISMA
 * firma y las pantallas no se tocan (build-plan.md §regla de oro).
 *
 * Las operaciones del originador (aprobar hitos, declarar default) existen
 * en el dominio pero NO se exponen acá: este producto es solo el lado del
 * inversionista.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ActivityEvent, Opportunity, Position } from "../types";
import { remainingToFund } from "../opportunity";
import { ACTIVITY, INITIAL_BALANCE, OPPORTUNITIES, POSITIONS } from "./seed";

/** Fecha de referencia del prototipo. */
export const TODAY = "2026-08-04";

const LATENCY_MS = 320;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type PlatformValue = {
  opportunities: Opportunity[];
  positions: Position[];
  activity: ActivityEvent[];
  balance: bigint;

  getOpportunity: (slug: string) => Opportunity | undefined;
  getPositionsFor: (slug: string) => Position[];

  invest: (slug: string, amount: bigint) => Promise<void>;
  addFunds: (amount: bigint) => Promise<void>;
  listPosition: (id: string, price: bigint) => Promise<void>;
  unlistPosition: (id: string) => Promise<void>;
  resetDemo: () => void;
};

const PlatformContext = createContext<PlatformValue | null>(null);

const cloneSeed = () => ({
  opportunities: structuredClone(OPPORTUNITIES),
  positions: structuredClone(POSITIONS),
  activity: structuredClone(ACTIVITY),
  balance: INITIAL_BALANCE,
});

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(cloneSeed);
  const { opportunities, positions, activity, balance } = state;

  const getOpportunity = useCallback(
    (slug: string) => opportunities.find((o) => o.slug === slug),
    [opportunities],
  );

  const getPositionsFor = useCallback(
    (slug: string) => positions.filter((p) => p.opportunitySlug === slug),
    [positions],
  );

  const invest = useCallback<PlatformValue["invest"]>(async (slug, amount) => {
    await sleep(LATENCY_MS);

    setState((s) => {
      const target = s.opportunities.find((o) => o.slug === slug);
      if (!target) return s;

      const left = remainingToFund(target);
      const capped = amount > left ? left : amount;
      if (capped <= 0n || capped > s.balance) return s;

      const raised = target.raisedAmount + capped;
      // Al completar la ronda el capital queda en escrow y el deal arranca.
      const filled = raised >= target.targetAmount;

      const position: Position = {
        id: `pos-${s.positions.length + 1}-${slug}`,
        opportunitySlug: slug,
        principal: capped,
        investedAt: TODAY,
        listedPrice: null,
      };

      const event: ActivityEvent = {
        id: `ev-${s.activity.length + 1}`,
        at: TODAY,
        kind: "invest",
        opportunitySlug: slug,
        title: "Inversión confirmada",
        detail: `${target.projectTitle} — ${target.company.name}`,
        amount: capped,
        direction: "out",
      };

      return {
        balance: s.balance - capped,
        positions: [position, ...s.positions],
        activity: [event, ...s.activity],
        opportunities: s.opportunities.map((o) =>
          o.slug === slug
            ? {
                ...o,
                raisedAmount: raised,
                investorCount: o.investorCount + 1,
                status: filled ? "active" : o.status,
              }
            : o,
        ),
      };
    });
  }, []);

  const addFunds = useCallback<PlatformValue["addFunds"]>(async (amount) => {
    await sleep(LATENCY_MS);
    setState((s) => {
      const event: ActivityEvent = {
        id: `ev-${s.activity.length + 1}`,
        at: TODAY,
        kind: "deposit",
        opportunitySlug: null,
        title: "Fondos agregados",
        detail: "Depósito a la cuenta",
        amount,
        direction: "in",
      };
      return {
        ...s,
        balance: s.balance + amount,
        activity: [event, ...s.activity],
      };
    });
  }, []);

  const listPosition = useCallback<PlatformValue["listPosition"]>(
    async (id, price) => {
      await sleep(LATENCY_MS);
      setState((s) => {
        const pos = s.positions.find((p) => p.id === id);
        if (!pos) return s;
        const opp = s.opportunities.find((o) => o.slug === pos.opportunitySlug);

        const event: ActivityEvent = {
          id: `ev-${s.activity.length + 1}`,
          at: TODAY,
          kind: "listing",
          opportunitySlug: pos.opportunitySlug,
          title: "Posición publicada en venta",
          detail: opp?.projectTitle ?? pos.opportunitySlug,
          amount: price,
          direction: "none",
        };

        return {
          ...s,
          activity: [event, ...s.activity],
          positions: s.positions.map((p) =>
            p.id === id ? { ...p, listedPrice: price } : p,
          ),
        };
      });
    },
    [],
  );

  const unlistPosition = useCallback<PlatformValue["unlistPosition"]>(
    async (id) => {
      await sleep(LATENCY_MS);
      setState((s) => ({
        ...s,
        positions: s.positions.map((p) =>
          p.id === id ? { ...p, listedPrice: null } : p,
        ),
      }));
    },
    [],
  );

  const resetDemo = useCallback(() => setState(cloneSeed()), []);

  const value = useMemo<PlatformValue>(
    () => ({
      opportunities,
      positions,
      activity,
      balance,
      getOpportunity,
      getPositionsFor,
      invest,
      addFunds,
      listPosition,
      unlistPosition,
      resetDemo,
    }),
    [
      opportunities,
      positions,
      activity,
      balance,
      getOpportunity,
      getPositionsFor,
      invest,
      addFunds,
      listPosition,
      unlistPosition,
      resetDemo,
    ],
  );

  return (
    <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error("usePlatform debe usarse dentro de <PlatformProvider>");
  return ctx;
}
