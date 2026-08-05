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
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { keccak256, toBytes, type Address } from "viem";
import { useAccessRegistry } from "@/hooks/useAccessRegistry";

export type Session = {
  address: string;
  createdAt: string;
  /** Elegibilidad de inversión leída del AccessRegistry desplegado. */
  verified: boolean;
  accessStatus: number;
};

const FIRST_SEEN_KEY = "founding.firstSeen"; // address -> ISO date

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
 * `verified` conserva la interfaz que ya consume la UI, pero su fuente
 * ahora es AccessRegistry y no localStorage.
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
  verify: () => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, logout } = usePrivy();
  // Dirección directo de Privy, NO de wagmi's useAccount(). El puente
  // @privy-io/wagmi puede tardar (o no llegar a tiempo) en sincronizar
  // el conector en una recarga fría — Privy es la fuente real de la
  // wallet embebida, wagmi es solo para leer/escribir en cadena después.
  const address = user?.wallet?.address ?? null;
  const access = useAccessRegistry((address ?? undefined) as Address | undefined);

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
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  // Ajustamos `session` DURANTE el render cuando cambian los valores de
  // Privy que la determinan — no en un efecto (evita el setState-en-
  // efecto, ver commit del bug de store.tsx con el mismo patrón).
  // `resolvedKey` es la "huella" de esos valores; solo se recalcula
  // session cuando esa huella cambia de verdad.
  const resolvedKey = `${ready}|${authenticated}|${address ?? ""}|${access.isAllowed}|${access.status}`;
  const [lastResolvedKey, setLastResolvedKey] = useState(resolvedKey);
  if (resolvedKey !== lastResolvedKey) {
    setLastResolvedKey(resolvedKey);
    if (ready) {
      if (!authenticated || !address) {
        setSession(null);
      } else {
        const addr = address.toLowerCase();
        const firstSeen = readJSON<Record<string, string>>(FIRST_SEEN_KEY, {});
        if (!firstSeen[addr]) {
          firstSeen[addr] = new Date().toISOString();
          writeJSON(FIRST_SEEN_KEY, firstSeen);
        }
        setSession({
          address,
          createdAt: firstSeen[addr],
          verified: access.isAllowed,
          accessStatus: access.status,
        });
      }
    }
  }

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

  // OJO: esto vive acá, no en un callback de Privy — un `logout()`
  // disparado por Privy internamente (expiración de sesión, un glitch de
  // HMR en dev, etc.) NO debe borrar "ya viste el onboarding". Solo la
  // acción explícita de "Cerrar sesión" del usuario lo hace.
  const signOut = useCallback(() => {
    try {
      window.localStorage.removeItem("founding.intro");
    } catch {}
    logout();
  }, [logout]);

  const verify = useCallback(async () => {
    if (!address) throw new Error("Conecta una wallet antes de solicitar acceso");
    const applicationHash = keccak256(
      toBytes(`fouding:access-request:v1:${address.toLowerCase()}`),
    );
    await access.requestAccess(applicationHash);
  }, [access, address]);

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
