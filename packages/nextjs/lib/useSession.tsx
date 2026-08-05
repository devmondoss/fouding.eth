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

export type Role = "investor" | "business";

export type Session = {
  address: string;
  createdAt: string;
  /** Elegibilidad de identidad. Mock local hasta que exista el
   * IdentityRegistry en cadena — ver conceptos-y-cambios.md. Cuando el
   * contrato esté desplegado, esto se reemplaza por un useReadContract
   * sobre `isEligible(address)`, no por un flag de localStorage. */
  verified: boolean;
  /** null = wallet nueva, todavía no eligió. Se fija una sola vez por
   * address en RoleGate y ya no cambia — una wallet es inversionista O
   * empresa, nunca las dos (ver conversación de arquitectura, agosto
   * 2026). Evita que el mismo `verified` se filtre entre un KYC de
   * persona y un KYB de empresa. */
  role: Role | null;
};

const FIRST_SEEN_KEY = "founding.firstSeen"; // address -> ISO date
const VERIFIED_KEY = "founding.verifiedAddresses"; // address[] — mock, ver arriba
const ROLE_KEY = "founding.role"; // address -> Role, fijado una sola vez
const SOFT_SIGNOUT_KEY = "founding.softSignOutAt"; // timestamp (ms) del último "cerrar sesión"
const SOFT_SIGNOUT_GRACE_MS = 60 * 60 * 1000; // 60 minutos

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

function readSoftSignOutAt(): number | null {
  try {
    const raw = window.localStorage.getItem(SOFT_SIGNOUT_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
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
  verify: () => void;
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

  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // "Cerrar sesión" oculta la sesión de inmediato pero difiere el logout
  // real de Privy hasta SOFT_SIGNOUT_GRACE_MS (ver efecto más abajo).
  //
  // Ya NO sirve para reingresar sin código: `connectWallet` siempre mata
  // el token antes de abrir el modal, porque si no Privy nunca pide
  // correo y era imposible entrar con otra cuenta. Lo que sigue
  // garantizando es que el token muera solo dentro de la hora aunque la
  // persona no vuelva a tocar nada — eso es una propiedad de seguridad y
  // por eso el temporizador se queda.
  const [softSignedOutAt, setSoftSignedOutAt] = useState<number | null>(() =>
    readSoftSignOutAt(),
  );

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
  const softHidden =
    softSignedOutAt !== null && Date.now() - softSignedOutAt < SOFT_SIGNOUT_GRACE_MS;

  const resolvedKey = `${ready}|${authenticated}|${address ?? ""}|${softHidden}`;
  const [lastResolvedKey, setLastResolvedKey] = useState(resolvedKey);
  if (resolvedKey !== lastResolvedKey) {
    setLastResolvedKey(resolvedKey);
    if (ready) {
      if (!authenticated || !address || softHidden) {
        setSession(null);
      } else {
        const addr = address.toLowerCase();
        const firstSeen = readJSON<Record<string, string>>(FIRST_SEEN_KEY, {});
        if (!firstSeen[addr]) {
          firstSeen[addr] = new Date().toISOString();
          writeJSON(FIRST_SEEN_KEY, firstSeen);
        }
        const verifiedList = readJSON<string[]>(VERIFIED_KEY, []);
        const roleMap = readJSON<Record<string, Role>>(ROLE_KEY, {});
        setSession({
          address,
          createdAt: firstSeen[addr],
          verified: verifiedList.includes(addr),
          role: roleMap[addr] ?? null,
        });
      }
    }
  }

  // Entrar SIEMPRE abre el modal de Privy, que es el único momento en que
  // se puede escribir un correo. Antes, si quedaba un token vivo de un
  // "cerrar sesión" reciente, reanudábamos la sesión anterior en silencio
  // y entrar con otra cuenta era imposible: nunca aparecía el campo de
  // correo (ver conversación de agosto 2026).
  //
  // Por eso el logout previo no es opcional. Con sesión viva, `login()`
  // no muestra nada: Privy dispara `onComplete` igual "for already- or
  // newly-authenticated users" (ver useLogin en @privy-io/react-auth), o
  // sea que resuelve con la cuenta anterior sin preguntar. Matar el token
  // antes es la única forma de que el modal aparezca.
  const connectWallet = useCallback(() => {
    try {
      window.localStorage.removeItem(SOFT_SIGNOUT_KEY);
    } catch {}
    setSoftSignedOutAt(null);
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
  // funciona la plataforma. Volver a explicárselo cada vez que
  // cierra sesión y vuelve a entrar es el bug que se reportó: repetir
  // el onboarding en un loop en vez de ir directo al login → catálogo.
  // Para volver a verlo a propósito existe el botón "Ver cómo
  // funciona" (TopBar/ProfilePanel), que sí llama a reset() explícito.
  //
  // Tampoco llama a logout() de Privy de inmediato — ver softSignedOutAt
  // arriba. El cierre real ocurre solo o al expirar la ventana de gracia.
  const signOut = useCallback(() => {
    const now = Date.now();
    try {
      window.localStorage.setItem(SOFT_SIGNOUT_KEY, String(now));
    } catch {}
    setSoftSignedOutAt(now);
  }, []);

  // Vencida la ventana de gracia, ahí sí se cierra la sesión de verdad
  // con Privy — este efecto es lo único que agenda ese cierre real,
  // tanto si el usuario se queda con la pestaña abierta como si vuelve
  // después de que ya venció.
  useEffect(() => {
    if (softSignedOutAt === null) return;
    const remaining = SOFT_SIGNOUT_GRACE_MS - (Date.now() - softSignedOutAt);
    const expire = () => {
      try {
        window.localStorage.removeItem(SOFT_SIGNOUT_KEY);
      } catch {}
      setSoftSignedOutAt(null);
      logout();
    };
    if (remaining <= 0) {
      expire();
      return;
    }
    const timeout = setTimeout(expire, remaining);
    return () => clearTimeout(timeout);
  }, [softSignedOutAt, logout]);

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
      writeJSON(
        VERIFIED_KEY,
        readJSON<string[]>(VERIFIED_KEY, []).filter((a) => a !== addr),
      );
      const roleMap = readJSON<Record<string, Role>>(ROLE_KEY, {});
      delete roleMap[addr];
      writeJSON(ROLE_KEY, roleMap);
    }
    try {
      window.localStorage.removeItem(SOFT_SIGNOUT_KEY);
    } catch {}
    setSoftSignedOutAt(null);
    await logout();
  }, [getAccessToken, logout, address]);

  const verify = useCallback(() => {
    if (!address) return;
    const addr = address.toLowerCase();
    const verifiedList = readJSON<string[]>(VERIFIED_KEY, []);
    if (!verifiedList.includes(addr)) {
      writeJSON(VERIFIED_KEY, [...verifiedList, addr]);
    }
    setSession((s) => (s ? { ...s, verified: true } : s));
  }, [address]);

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

/** Tope de ticket para wallets sin verificar. Ver InvestPanel. */
export const UNVERIFIED_TICKET_CAP = 5_000;
