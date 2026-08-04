"use client";

import { useEffect, useState } from "react";

/**
 * Marca algo como "ya visto" de forma persistente.
 *
 * Devuelve `null` durante el primer render para evitar desajuste de
 * hidratación: el servidor no puede saber qué vio este navegador.
 */
export function useOnce(key: string): {
  seen: boolean | null;
  markSeen: () => void;
  reset: () => void;
} {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setSeen(window.localStorage.getItem(key) === "1");
    } catch {
      setSeen(true); // sin almacenamiento, no insistimos
    }
  }, [key]);

  return {
    seen,
    markSeen: () => {
      try {
        window.localStorage.setItem(key, "1");
      } catch {}
      setSeen(true);
    },
    reset: () => {
      try {
        window.localStorage.removeItem(key);
      } catch {}
      setSeen(false);
    },
  };
}
