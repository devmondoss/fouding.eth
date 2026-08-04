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

export type Session = {
  address: string;
  createdAt: string;
  /** Verificación de identidad. Mock: no hay KYC real detrás. */
  verified: boolean;
};

const KEY = "founding.session";

/**
 * Sesión compartida vía contexto — no un hook aislado — porque más de un
 * componente necesita LEER Y REACCIONAR al mismo estado (TopBar, Profile,
 * InvestPanel). Con hooks independientes cada uno lee su propia copia de
 * localStorage al montar y no se entera de los cambios de los demás.
 *
 * En el producto real esto lo resolvería un proveedor de embedded wallets
 * (Privy, Turnkey). Acá replicamos el flujo: la wallet se crea sin pedir
 * datos: la verificación es una puerta posterior, no previa — ver
 * design-system.md §6.
 */
type Ctx = {
  session: Session | null | undefined; // undefined = leyendo almacenamiento
  signIn: (s: Omit<Session, "verified">) => void;
  signOut: () => void;
  verify: () => void;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      setSession(raw ? (JSON.parse(raw) as Session) : null);
    } catch {
      setSession(null);
    }
  }, []);

  const persist = useCallback((s: Session | null) => {
    try {
      if (s) window.localStorage.setItem(KEY, JSON.stringify(s));
      else window.localStorage.removeItem(KEY);
    } catch {}
    setSession(s);
  }, []);

  const signIn = useCallback<Ctx["signIn"]>(
    (s) => persist({ ...s, verified: false }),
    [persist],
  );

  const signOut = useCallback(() => {
    persist(null);
    try {
      window.localStorage.removeItem("founding.intro");
    } catch {}
  }, [persist]);

  const verify = useCallback(() => {
    setSession((s) => {
      if (!s) return s;
      const next = { ...s, verified: true };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ session, signIn, signOut, verify }),
    [session, signIn, signOut, verify],
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

/** Dirección plausible derivada de una semilla. No es criptografía. */
export function mockAddress(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    h1 = (h1 ^ seed.charCodeAt(i)) >>> 0;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (h2 + Math.imul(seed.charCodeAt(i) + i, 0x9e3779b1)) >>> 0;
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return `0x${hex(h1)}${hex(h2)}${hex(h1 ^ h2)}${hex(h1 + h2)}${hex(h2 ^ 0x5bf03635)}`.slice(
    0,
    42,
  );
}

/** Tope de ticket para wallets sin verificar. Ver InvestPanel. */
export const UNVERIFIED_TICKET_CAP = 5_000;
