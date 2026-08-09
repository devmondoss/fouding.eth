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
import { type Address } from "viem";
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
 * `verified` conserva la interfaz que ya consume la UI, pero su fuente
 * ahora es AccessRegistry y no localStorage.
 */
type Ctx = {
  session: Session | null | undefined; // undefined = resolviendo conexión
  /** Abre el login de Privy y crea la wallet embebida al instante —
   * cero pantallas de un tercero, cero extensión (ver
   * components/providers/Web3Provider.tsx). SIEMPRE pide correo: mata el
   * token vivo antes de abrir el modal, que es lo único que permite
   * entrar con otra cuenta (ver implementación). */
  /** Entrar. Con sesión viva no pide nada: entra con ella. */
  connectWallet: () => void;
  /** Entrar con otra cuenta: cierra la sesión viva y pide correo. */
  switchAccount: () => void;
  /** Lado ya fijado para la wallet conectada, aunque la sesión esté
   * oculta por un "cerrar sesión" reciente. La puerta lo usa para no
   * ofrecer una elección que ya está tomada. */
  knownRole: Role | null;
  /** Correo de la sesión que sigue viva detrás de un "cerrar sesión"
   * reciente, o null. Cuando no es null la pantalla de login puede
   * ofrecer reanudar sin código — ver `resumeSession`. */
  pendingAccount: string | null;
  /** Reanuda la sesión oculta por `signOut` sin pasar por Privy: el
   * token nunca murió, así que no hay correo ni código que pedir. Solo
   * tiene efecto dentro de la ventana de gracia. */
  resumeSession: () => void;
  connecting: boolean;
  connectError: string | null;
  /** Corta manualmente el estado "conectando" — necesario porque Privy
   * no siempre dispara onError cuando el usuario cierra el modal
   * tocando afuera (queda pegado en "esperando confirmación" si no). */
  cancelConnect: () => void;
  signOut: () => void;
  /** Registra la solicitud de acceso: guarda la identidad declarada fuera
   * de cadena y ancla su hash en el AccessRegistry. */
  verify: (applicant: { fullName: string; documentId: string }) => Promise<void>;
  /** Fija el rol la primera vez que se llama para esta wallet. Llamadas
   * posteriores no hacen nada — el rol no cambia una vez elegido (ver
   * RoleGate). */
  chooseRole: (role: Role) => void;
  /** Borrado real, irreversible: llama al backend, que borra el usuario
   * en Privy. Libera el correo para que pueda registrarse como cuenta
   * nueva — no es solo limpiar datos locales. */
  deleteAccount: () => Promise<void>;
  /** Token de sesión para llamar rutas del backend que exigen identidad
   * (crear un expediente, subir un documento). El servidor lo verifica y
   * deriva la wallet de ahí, en vez de creerle al body. */
  getAccessToken: () => Promise<string | null>;
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

  // "Cerrar sesión" oculta la sesión al instante pero deja vivo el token
  // de Privy por SOFT_SIGNOUT_GRACE_MS. No es para reanudar a escondidas
  // — eso era el bug de no poder cambiar de cuenta — sino para que la
  // pantalla de login pueda OFRECER reanudar sin código (ver
  // `pendingAccount` y `resumeSession`). Quien quiera otra cuenta toca
  // "entrar con otro correo" y ahí sí se mata el token.
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
  // Basta con que exista la marca: el efecto de más abajo es el dueño de
  // su vencimiento y la borra al expirar (llamando además a logout). Antes
  // acá se comparaba contra `Date.now()` en pleno render, que es una
  // llamada impura —el resultado cambia entre dos renders idénticos— y
  // encima daba un peor comportamiento: con la gracia ya vencida y el
  // efecto todavía sin correr, la sesión se mostraba un instante justo
  // antes de cerrarse.
  const softHidden = softSignedOutAt !== null;

  const resolvedKey = `${ready}|${authenticated}|${address ?? ""}|${access.isAllowed}|${access.status}|${softHidden}`;
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
  //
  // `login()` NO se llama encadenado al `.then()` de logout(): esa
  // promesa resuelve antes de que el estado interno de Privy (Privy
  // context `authenticated`) realmente se asiente en false, así que
  // `login()` podía no abrir nada — se quedaba pegado en "Esperando
  // confirmación" para siempre porque Privy nunca disparaba onComplete
  // ni onError (bug reportado: bucle infinito al entrar con otra
  // cuenta). En vez de eso, se pide el logout y un efecto aparte espera
  // a que `authenticated` pase a false de verdad para recién ahí abrir
  // el login — con una referencia fresca de `login`, no la capturada
  // antes del logout.
  const [awaitingLogoutForLogin, setAwaitingLogoutForLogin] = useState(false);

  /**
   * El lado de esta dirección, leído del mapa aunque la sesión esté
   * oculta: durante el "cerrar sesión" suave Privy sigue autenticado y
   * sabemos de quién es la wallet, así que la puerta puede reconocerla y
   * no ofrecer una elección que ya está tomada.
   */
  const knownRole = useMemo<Role | null>(() => {
    if (!address) return null;
    const roleMap = readJSON<Record<string, Role>>(ROLE_KEY, {});
    return roleMap[address.toLowerCase()] ?? null;
  }, [address]);

  /**
   * Entrar. Si ya hay una sesión viva, se ENTRA con ella.
   *
   * Antes esto deslogueaba siempre y volvía a abrir el modal de Privy,
   * porque era la única forma de que apareciera el campo de correo para
   * cambiar de cuenta. El precio lo pagaba el caso normal: alguien que ya
   * había entrado y volvía a tocar la puerta perdía la sesión y tenía que
   * escribir correo y código otra vez. Cambiar de cuenta es otra
   * intención, y ahora tiene su propia puerta (`switchAccount`).
   */
  const connectWallet = useCallback(() => {
    try {
      window.localStorage.removeItem(SOFT_SIGNOUT_KEY);
    } catch {}
    setSoftSignedOutAt(null);
    setConnectError(null);
    // Sesión viva: no hay nada que pedir. El efecto de arriba ya la
    // resolvió y quien llame decide a dónde llevar a esta persona.
    if (authenticated && address) return;
    setConnecting(true);
    login();
  }, [login, authenticated, address]);

  /**
   * Entrar con OTRA cuenta. Acá el logout sí es obligatorio: con token
   * vivo, `login()` no muestra nada —Privy dispara `onComplete` igual
   * "for already- or newly-authenticated users"— y resolvería con la
   * cuenta anterior sin preguntar.
   */
  const switchAccount = useCallback(() => {
    try {
      window.localStorage.removeItem(SOFT_SIGNOUT_KEY);
    } catch {}
    setSoftSignedOutAt(null);
    setConnectError(null);
    setConnecting(true);
    if (authenticated) {
      setAwaitingLogoutForLogin(true);
      logout();
    } else {
      login();
    }
  }, [login, logout, authenticated]);

  useEffect(() => {
    if (!awaitingLogoutForLogin) return;
    if (authenticated) return; // todavía no se asentó el logout
    setAwaitingLogoutForLogin(false);
    login();
  }, [awaitingLogoutForLogin, authenticated, login]);

  // El correo de la sesión que quedó viva detrás del "cerrar sesión".
  // Solo se ofrece dentro de la ventana de gracia: pasada esa hora el
  // token ya murió y reanudar no significaría nada.
  const pendingAccount =
    softHidden && authenticated && address ? (user?.email?.address ?? null) : null;

  // Reanudar es puramente local: se borra la marca de "cerrar sesión" y
  // la sesión vuelve a resolverse sola con el token que nunca murió. Sin
  // llamadas a Privy, o sea sin correo y sin código.
  const resumeSession = useCallback(() => {
    try {
      window.localStorage.removeItem(SOFT_SIGNOUT_KEY);
    } catch {}
    setSoftSignedOutAt(null);
  }, []);

  // Red de seguridad: si Privy nunca avisa (usuario cierra el modal
  // tocando afuera, o se cuelga por lo que sea), no dejamos a nadie
  // mirando un spinner para siempre.
  useEffect(() => {
    if (!connecting) return;
    const timeout = setTimeout(() => {
      setConnecting(false);
      setAwaitingLogoutForLogin(false);
    }, 45_000);
    return () => clearTimeout(timeout);
  }, [connecting]);

  const cancelConnect = useCallback(() => {
    setAwaitingLogoutForLogin(false);
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
  //
  // Tampoco llama a logout() de inmediato: oculta la sesión y deja el
  // token vivo una hora, para poder ofrecer "continuar como X" sin
  // código. El cierre real lo agenda el efecto de abajo.
  const signOut = useCallback(() => {
    const now = Date.now();
    try {
      window.localStorage.setItem(SOFT_SIGNOUT_KEY, String(now));
    } catch {}
    setSoftSignedOutAt(now);
  }, []);

  // Vencida la ventana de gracia, ahí sí se cierra de verdad con Privy.
  // Este efecto es lo único que agenda ese cierre real, tanto si la
  // pestaña se queda abierta como si se vuelve después de que venció.
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

  // La identidad declarada se guarda primero en el backend, que devuelve
  // el hash calculado SOBRE esos datos. Ese es el que va a la cadena.
  //
  // Antes el hash se derivaba solo de la dirección y el nombre y el
  // documento se descartaban en el cliente: el formulario pedía PII que
  // no llegaba a ninguna parte, y compliance aprobaba sin ver nada.
  const verify = useCallback(
    async (applicant: { fullName: string; documentId: string }) => {
      if (!address) throw new Error("Conecta una wallet antes de solicitar acceso");

      const token = await getAccessToken();
      if (!token) throw new Error("Tu sesión expiró, vuelve a entrar");

      const res = await fetch("/api/compliance/application", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(applicant),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ?? "No se pudo registrar la solicitud");
      }

      await access.requestAccess(body.applicationHash as `0x${string}`);
    },
    [access, address, getAccessToken],
  );

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
    try {
      window.localStorage.removeItem(SOFT_SIGNOUT_KEY);
    } catch {}
    setSoftSignedOutAt(null);
    await logout();
  }, [getAccessToken, logout, address]);

  const value = useMemo<Ctx>(
    () => ({
      session,
      connectWallet,
      switchAccount,
      knownRole,
      pendingAccount,
      resumeSession,
      connecting,
      connectError,
      cancelConnect,
      signOut,
      verify,
      chooseRole,
      deleteAccount,
      getAccessToken,
    }),
    [
      session,
      connectWallet,
      switchAccount,
      knownRole,
      pendingAccount,
      resumeSession,
      connecting,
      connectError,
      cancelConnect,
      signOut,
      verify,
      chooseRole,
      deleteAccount,
      getAccessToken,
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
