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

export type Role = "investor" | "business";

export type Session = {
  address: string;
  createdAt: string;
  /** Elegibilidad de inversión leída del AccessRegistry desplegado. */
  verified: boolean;
  accessStatus: number;
  /** null = wallet nueva, todavía no eligió. Se fija una sola vez por
   * address en RoleGate y ya no cambia — una wallet es inversionista O
   * empresa, nunca las dos (ver conversación de arquitectura, agosto
   * 2026). Mantiene separados el KYC de la persona (que es lo que mide
   * `verified` vía AccessRegistry) del KYB de la empresa. */
  role: Role | null;
};

const FIRST_SEEN_KEY = "founding.firstSeen"; // address -> ISO date
const ROLE_KEY = "founding.role"; // address -> Role, fijado una sola vez

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
   * components/providers/Web3Provider.tsx). Siempre pide correo: es lo
   * que permite entrar con otra cuenta (ver implementación). */
  connectWallet: () => void;
  connecting: boolean;
  connectError: string | null;
  /** Corta manualmente el estado "conectando" — necesario porque Privy
   * no siempre dispara onError cuando el usuario cierra el modal
   * tocando afuera (queda pegado en "esperando confirmación" si no). */
  cancelConnect: () => void;
  signOut: () => void;
  verify: () => Promise<void>;
  /** Fija el rol la primera vez que se llama para esta wallet. Llamadas
   * posteriores no hacen nada — el rol no cambia una vez elegido (ver
   * RoleGate). */
  chooseRole: (role: Role) => void;
  /** Borrado real, irreversible: llama al backend, que borra el usuario
   * en Privy. Libera el correo para que pueda registrarse como cuenta
   * nueva — no es solo limpiar datos locales. */
  deleteAccount: () => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy();
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
        const roleMap = readJSON<Record<string, Role>>(ROLE_KEY, {});
        setSession({
          address,
          createdAt: firstSeen[addr],
          verified: access.isAllowed,
          accessStatus: access.status,
          role: roleMap[addr] ?? null,
        });
      }
    }
  }

  // Entrar SIEMPRE abre el modal de Privy, que es el único momento en que
  // se puede escribir un correo. Antes, si quedaba un token vivo, Privy
  // reanudaba la sesión anterior en silencio y entrar con otra cuenta era
  // imposible: nunca aparecía el campo de correo (ver conversación de
  // agosto 2026).
  //
  // Por eso el logout previo no es opcional. Con sesión viva, `login()`
  // no muestra nada: Privy dispara `onComplete` igual "for already- or
  // newly-authenticated users" (ver useLogin en @privy-io/react-auth), o
  // sea que resuelve con la cuenta anterior sin preguntar. Matar el token
  // antes es la única forma de que el modal aparezca.
  const connectWallet = useCallback(() => {
    setConnectError(null);
    setConnecting(true);
    if (authenticated) logout().finally(() => login());
    else login();
  }, [login, logout, authenticated]);

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

  // Cerrar sesión NO reinicia "ya viste el onboarding" — quien vuelve a
  // entrar (mismo navegador, otra wallet o la misma) ya sabe cómo
  // funciona la plataforma. Volver a explicárselo en cada reingreso es el
  // bug que se reportó: repetir el onboarding en loop en vez de ir
  // directo al login → catálogo. Para volver a verlo a propósito existe
  // el botón "Ver cómo funciona" (TopBar/ProfilePanel), que sí llama a
  // reset() explícito.
  const signOut = useCallback(() => {
    logout();
  }, [logout]);

  const verify = useCallback(async () => {
    if (!address) throw new Error("Conecta una wallet antes de solicitar acceso");
    const applicationHash = keccak256(
      toBytes(`fouding:access-request:v1:${address.toLowerCase()}`),
    );
    await access.requestAccess(applicationHash);
  }, [access, address]);

  const chooseRole = useCallback(
    (role: Role) => {
      if (!address) return;
      const addr = address.toLowerCase();
      const roleMap = readJSON<Record<string, Role>>(ROLE_KEY, {});
      if (roleMap[addr]) return; // ya elegido, no se puede cambiar
      roleMap[addr] = role;
      writeJSON(ROLE_KEY, roleMap);
      setSession((s) => (s ? { ...s, role } : s));
    },
    [address],
  );

  const deleteAccount = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) throw new Error("No se pudo verificar tu sesión");

    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "No se pudo eliminar la cuenta");
    }

    if (address) {
      const addr = address.toLowerCase();
      const firstSeen = readJSON<Record<string, string>>(FIRST_SEEN_KEY, {});
      delete firstSeen[addr];
      writeJSON(FIRST_SEEN_KEY, firstSeen);
      const roleMap = readJSON<Record<string, Role>>(ROLE_KEY, {});
      delete roleMap[addr];
      writeJSON(ROLE_KEY, roleMap);
    }
    await logout();
  }, [getAccessToken, logout, address]);

  const value = useMemo<Ctx>(
    () => ({
      session,
      connectWallet,
      connecting,
      connectError,
      cancelConnect,
      signOut,
      verify,
      chooseRole,
      deleteAccount,
    }),
    [
      session,
      connectWallet,
      connecting,
      connectError,
      cancelConnect,
      signOut,
      verify,
      chooseRole,
      deleteAccount,
    ],
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
