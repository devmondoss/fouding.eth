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
import { useAccount } from "wagmi";
import { useLogin, useLogout, usePrivy } from "@privy-io/react-auth";

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
  /** Abre el login de Privy y crea la wallet embebida al instante —
   * cero pantallas de un tercero, cero extensión (ver
   * components/providers/Web3Provider.tsx). */
  connectWallet: () => void;
  connecting: boolean;
  connectError: string | null;
  /** Corta manualmente el estado "conectando" — necesario porque Privy
   * no siempre dispara onError cuando el usuario cierra el modal
   * tocando afuera (queda pegado en "esperando confirmación" si no). */
  cancelConnect: () => void;
  signOut: () => void;
  verify: () => void;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, logout } = usePrivy();
  const { address, status: accountStatus } = useAccount();

  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const { login } = useLogin({
    onComplete: () => setConnecting(false),
    onError: (err) => {
      setConnecting(false);
      setConnectError(
        err === "exited_auth_flow" ? null : "No se pudo conectar. Intenta de nuevo.",
      );
    },
  });
  useLogout({
    onSuccess: () => {
      try {
        window.localStorage.removeItem("founding.intro");
      } catch {}
    },
  });

  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!ready) return; // el SDK de Privy todavía está resolviendo la sesión previa

    if (!authenticated || accountStatus !== "connected" || !address) {
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
  }, [ready, authenticated, accountStatus, address]);

  const connectWallet = useCallback(() => {
    setConnectError(null);
    setConnecting(true);
    login();
  }, [login]);

  // Red de seguridad: si Privy nunca avisa (usuario cierra el modal
  // tocando afuera, o se cuelga por lo que sea), no dejamos a nadie
  // mirando un spinner para siempre.
  useEffect(() => {
    if (!connecting) return;
    const timeout = setTimeout(() => setConnecting(false), 45_000);
    return () => clearTimeout(timeout);
  }, [connecting]);

  const cancelConnect = useCallback(() => {
    setConnecting(false);
    setConnectError(null);
  }, []);

  const signOut = useCallback(() => {
    logout();
  }, [logout]);

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
      connecting,
      connectError,
      cancelConnect,
      signOut,
      verify,
    }),
    [session, connectWallet, connecting, connectError, cancelConnect, signOut, verify],
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
