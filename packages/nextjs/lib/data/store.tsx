"use client";

/**
 * Adaptador de datos del lado INVERSIONISTA. Las pantallas nunca leen
 * datos directamente: consumen esta interfaz (build-plan.md §regla de oro).
 *
 * Qué es real y qué no, hoy:
 *
 *   opportunities  REAL — Postgres, publicadas por el verificador. Si la
 *                  base no responde cae al seed y lo AVISA (usingSeedData).
 *   positions      mock — localStorage por wallet
 *   balance        mock — localStorage por wallet
 *   activity       mock — localStorage por wallet
 *
 * La inversión sí toca la cadena (ver InvestPanel: approve + fund contra
 * el CreditVault); lo que sigue siendo proyección local es el reflejo de
 * esa operación en el portafolio.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ActivityEvent, Opportunity, Position } from "../types";
import { remainingToFund } from "../opportunity";
import { useSession } from "../useSession";
import { opportunityFromWire, type WireOpportunity } from "../opportunities/wire";
import type { WireActivityEvent } from "../db/onchainActivity";
import { OPPORTUNITIES } from "./seed";

/**
 * El catálogo (OPPORTUNITIES) es compartido — es el "mercado", no algo
 * de un usuario. Pero POSITIONS/ACTIVITY/INITIAL_BALANCE de seed.ts son
 * LA DEMO, no pertenecen a nadie en particular. Ahora que hay wallets
 * reales, mostrárselos a cualquiera que conecte confunde: parece que
 * ya tenías 15,000 USDC invertidos en una cuenta que acabás de crear.
 *
 * Por eso el balance/posiciones/actividad se guardan por dirección de
 * wallet (localStorage) y una wallet nunca antes vista arranca en
 * cero — la demo pre-sembrada queda solo como fallback para cuando no
 * hay wallet conectada (session === null/undefined).
 */
type WalletState = {
  positions: Position[];
  activity: ActivityEvent[];
  balance: bigint;
};

const WALLET_KEY_PREFIX = "founding.wallet.";

function loadWalletState(address: string): WalletState {
  try {
    const raw = window.localStorage.getItem(
      WALLET_KEY_PREFIX + address.toLowerCase(),
    );
    if (!raw) return { positions: [], activity: [], balance: 0n };
    const parsed = JSON.parse(raw) as {
      positions: (Omit<Position, "principal" | "listedPrice"> & {
        principal: string;
        listedPrice: string | null;
      })[];
      activity: (Omit<ActivityEvent, "amount"> & { amount: string | null })[];
      balance: string;
    };
    return {
      positions: parsed.positions.map((p) => ({
        ...p,
        principal: BigInt(p.principal),
        listedPrice: p.listedPrice != null ? BigInt(p.listedPrice) : null,
      })),
      activity: parsed.activity.map((e) => ({
        ...e,
        amount: e.amount != null ? BigInt(e.amount) : null,
      })),
      balance: BigInt(parsed.balance),
    };
  } catch {
    return { positions: [], activity: [], balance: 0n };
  }
}

function saveWalletState(address: string, state: WalletState) {
  try {
    const serializable = {
      positions: state.positions.map((p) => ({
        ...p,
        principal: p.principal.toString(),
        listedPrice: p.listedPrice != null ? p.listedPrice.toString() : null,
      })),
      activity: state.activity.map((e) => ({
        ...e,
        amount: e.amount != null ? e.amount.toString() : null,
      })),
      balance: state.balance.toString(),
    };
    window.localStorage.setItem(
      WALLET_KEY_PREFIX + address.toLowerCase(),
      JSON.stringify(serializable),
    );
  } catch {}
}

/** Fecha de referencia del prototipo. */
export const TODAY = "2026-08-04";

const LATENCY_MS = 320;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type PlatformValue = {
  opportunities: Opportunity[];
  positions: Position[];
  activity: ActivityEvent[];
  balance: bigint;

  /** El catálogo todavía no llegó del servidor. */
  loadingOpportunities: boolean;
  /**
   * El catálogo que se está mostrando es el sembrado de demo, no lo que
   * publicó un verificador. Se expone para poder DECIRLO en pantalla: un
   * fallback silencioso a datos de mentira es justo lo que no queremos
   * (checklist.md §Presentación, "cierre honesto: qué es real y qué no").
   */
  usingSeedData: boolean;
  refreshOpportunities: () => Promise<void>;

  getOpportunity: (slug: string) => Opportunity | undefined;
  getPositionsFor: (slug: string) => Position[];

  invest: (slug: string, amount: bigint) => Promise<void>;
  addFunds: (amount: bigint) => Promise<void>;
  listPosition: (id: string, price: bigint) => Promise<void>;
  unlistPosition: (id: string) => Promise<void>;
};

const PlatformContext = createContext<PlatformValue | null>(null);

const emptyWalletState = (): WalletState => ({
  positions: [],
  activity: [],
  balance: 0n,
});

export function PlatformProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const address = session?.address ?? null;

  const [state, setState] = useState(() => ({
    opportunities: structuredClone(OPPORTUNITIES),
    ...(address ? loadWalletState(address) : emptyWalletState()),
  }));

  // El catálogo ya no vive en seed.ts: lo publica el verificador y sale de
  // Postgres (ver POST /api/verifier/submissions/[id]/publish). El seed
  // queda solo como red de seguridad para que la app no aparezca vacía si
  // la base no está configurada — y cuando eso pasa se avisa, no se
  // disimula (ver `usingSeedData`).
  const [loadingOpportunities, setLoadingOpportunities] = useState(true);
  const [usingSeedData, setUsingSeedData] = useState(true);

  const refreshOpportunities = useCallback(async () => {
    setLoadingOpportunities(true);
    try {
      const res = await fetch("/api/opportunities");
      if (!res.ok) throw new Error(String(res.status));
      const wire = (await res.json()) as WireOpportunity[];
      if (wire.length === 0) throw new Error("catálogo vacío");
      setState((s) => ({ ...s, opportunities: wire.map(opportunityFromWire) }));
      setUsingSeedData(false);
    } catch {
      setState((s) => ({ ...s, opportunities: structuredClone(OPPORTUNITIES) }));
      setUsingSeedData(true);
    } finally {
      setLoadingOpportunities(false);
    }
  }, []);

  useEffect(() => {
    refreshOpportunities();
  }, [refreshOpportunities]);

  // Actividad REAL de la cadena, escrita por scripts/indexer.ts. Convive
  // con la local en vez de reemplazarla porque cubren cosas distintas: la
  // cadena sabe de aportes, pagos y recuperos; los depósitos a la cuenta
  // y las publicaciones en el libro de órdenes solo existen acá.
  const [chainActivity, setChainActivity] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    if (!address) {
      setChainActivity([]);
      return;
    }
    let alive = true;
    fetch(`/api/activity?wallet=${address}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: WireActivityEvent[]) => {
        if (!alive) return;
        setChainActivity(
          rows.map((e) => ({
            ...e,
            kind: e.kind as ActivityEvent["kind"],
            amount: e.amount != null ? BigInt(e.amount) : null,
          })),
        );
      })
      .catch(() => alive && setChainActivity([]));
    return () => {
      alive = false;
    };
  }, [address]);

  // Ajustamos el estado DURANTE el render cuando cambia la wallet — no en
  // un efecto (evita el setState-en-efecto) y sin remontar `children`
  // (evita resetear estado no relacionado de la app, como el onboarding
  // o el "ya entré" de AuthFlow — eso pasaba antes con key={address}).
  const [loadedFor, setLoadedFor] = useState(address);
  if (address !== loadedFor) {
    setLoadedFor(address);
    setState((s) => ({
      ...s,
      ...(address ? loadWalletState(address) : emptyWalletState()),
    }));
  }

  const { opportunities, positions, activity, balance } = state;

  // Y lo persistimos cada vez que cambia, mientras haya wallet conectada.
  useEffect(() => {
    if (!address) return;
    saveWalletState(address, { positions, activity, balance });
  }, [address, positions, activity, balance]);

  // Kinds que la cadena conoce de verdad. Cuando el indexer devolvió algo
  // para esta wallet, esos eventos MANDAN y se descarta el reflejo local,
  // que era solo optimista. Si no devolvió nada (indexer apagado, o vault
  // sin desplegar) se muestra el local — pero nunca los dos, porque
  // duplicaría cada aporte en el historial.
  const CHAIN_KINDS: ActivityEvent["kind"][] = [
    "invest",
    "release",
    "repayment",
    "default",
    "recovery",
  ];

  const mergedActivity = useMemo<ActivityEvent[]>(() => {
    if (chainActivity.length === 0) return activity;
    const local = activity.filter((e) => !CHAIN_KINDS.includes(e.kind));
    return [...chainActivity, ...local].sort((a, b) =>
      a.at < b.at ? 1 : a.at > b.at ? -1 : 0,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, chainActivity]);

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

  const value = useMemo<PlatformValue>(
    () => ({
      opportunities,
      positions,
      activity: mergedActivity,
      balance,
      loadingOpportunities,
      usingSeedData,
      refreshOpportunities,
      getOpportunity,
      getPositionsFor,
      invest,
      addFunds,
      listPosition,
      unlistPosition,
    }),
    [
      opportunities,
      positions,
      mergedActivity,
      balance,
      loadingOpportunities,
      usingSeedData,
      refreshOpportunities,
      getOpportunity,
      getPositionsFor,
      invest,
      addFunds,
      listPosition,
      unlistPosition,
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
