"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export type Session = {
  address: string;
  createdAt: string;
  /** Elegibilidad de identidad. Mock local hasta que exista el
   * IdentityRegistry en cadena — ver conceptos-y-cambios.md. Cuando el
   * contrato esté desplegado, esto se reemplaza por un useReadContract
   * sobre `isEligible(address)`, no por un flag de localStorage. */
  verified: boolean;
};

const FIRST_SEEN_KEY = "founding.firstSeen"; // address -> ISO date
const VERIFIED_KEY = "founding.verifiedAddresses"; // address[] — mock, ver arriba

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/**
 * Sesión = wallet conectada de verdad (wagmi), no una wallet generada.
 * Se comparte vía contexto porque más de un componente necesita LEER Y
 * REACCIONAR al mismo estado (TopBar, Profile, InvestPanel).
 *
 * `verified` sigue siendo local por ahora — es la pieza que el
 * IdentityRegistry (Rust/Stylus, en construcción por separado) va a
 * reemplazar. El resto de la app no debería notar el cambio cuando eso
 * pase: sigue leyendo `session.verified` desde acá.
 */
type Ctx = {
  session: Session | null | undefined; // undefined = resolviendo conexión
  /** Abre el selector de wallet (hoy: conector injected — MetaMask, Rabby,
   * etc. WalletConnect se agrega en lib/web3/config.ts cuando haya un
   * project id). */
  connectWallet: () => void;
  connecting: boolean;
  connectError: string | null;
  hasInjectedWallet: boolean;
  signOut: () => void;
  verify: () => void;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { address, status: accountStatus } = useAccount();
  const { connect, connectors, status: connectStatus, error, reset } = useConnect();
  const { disconnect } = useDisconnect();

  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // "reconnecting" = wagmi está revisando si ya había una wallet
    // conectada antes (recarga de página) — no es "desconectado" todavía.
    if (accountStatus === "connecting" || accountStatus === "reconnecting") {
      return;
    }
    if (accountStatus !== "connected" || !address) {
      setSession(null);
      return;
    }

    const addr = address.toLowerCase();
    const firstSeen = readJSON<Record<string, string>>(FIRST_SEEN_KEY, {});
    if (!firstSeen[addr]) {
      firstSeen[addr] = new Date().toISOString();
      writeJSON(FIRST_SEEN_KEY, firstSeen);
    }
    const verifiedList = readJSON<string[]>(VERIFIED_KEY, []);

    setSession({
      address,
      createdAt: firstSeen[addr],
      verified: verifiedList.includes(addr),
    });
  }, [accountStatus, address]);

  const connectWallet = useCallback(() => {
    reset();
    const injectedConnector = connectors[0];
    if (injectedConnector) connect({ connector: injectedConnector });
  }, [connect, connectors, reset]);

  const signOut = useCallback(() => {
    disconnect();
    try {
      window.localStorage.removeItem("founding.intro");
    } catch {}
  }, [disconnect]);

  const verify = useCallback(() => {
    if (!address) return;
    const addr = address.toLowerCase();
    const verifiedList = readJSON<string[]>(VERIFIED_KEY, []);
    if (!verifiedList.includes(addr)) {
      writeJSON(VERIFIED_KEY, [...verifiedList, addr]);
    }
    setSession((s) => (s ? { ...s, verified: true } : s));
  }, [address]);

  const value = useMemo<Ctx>(
    () => ({
      session,
      connectWallet,
      connecting: connectStatus === "pending",
      connectError: error?.message ?? null,
      hasInjectedWallet: connectors.length > 0,
      signOut,
      verify,
    }),
    [session, connectWallet, connectStatus, error, connectors, signOut, verify],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}

/** Tope de ticket para wallets sin verificar. Ver InvestPanel. */
export const UNVERIFIED_TICKET_CAP = 5_000;
