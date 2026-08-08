"use client";

import { useEffect } from "react";
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
        {/* El triángulo en un círculo rojo era el sello de error genérico.
            El titular ya dice que algo falló. */}
        <h1 className="h2 text-[16px]" style={{ color: "var(--negative)" }}>
          Algo falló
        </h1>
        <p className="mt-1.5 text-[13px] text-mid">
          Hubo un problema cargando la plataforma. Puede ser temporal.
        </p>
        <Button className="mt-4 w-full" onClick={reset}>
          Reintentar
        </Button>
      </div>
    </div>
  );
}
