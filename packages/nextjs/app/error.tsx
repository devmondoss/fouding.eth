"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Boundary de la ruta principal — atrapa errores de render dentro de
 * `app/page.tsx` (ej. Privy sin inicializar, un fetch al backend del
 * verificador que revienta) para no dejar la pantalla en blanco.
 * `global-error.tsx` es el respaldo si el error ocurre en el layout
 * mismo, más arriba de donde este boundary alcanza.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-bg px-4">
      <div className="card max-w-[400px] p-6 text-center">
        <div
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border"
          style={{ borderColor: "var(--negative)" }}
        >
          <AlertTriangle className="h-5 w-5" style={{ color: "var(--negative)" }} />
        </div>
        <h1 className="h2 mt-3 text-[16px]">Algo falló</h1>
        <p className="mt-1.5 text-[13px] text-mid">
          Hubo un problema cargando la plataforma. Puede ser algo temporal —
          intenta de nuevo.
        </p>
        <Button className="mt-4 w-full" onClick={reset}>
          Reintentar
        </Button>
      </div>
    </div>
  );
}
