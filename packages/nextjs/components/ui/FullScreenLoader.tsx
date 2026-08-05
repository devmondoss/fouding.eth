import { Loader2 } from "lucide-react";

/**
 * Pantalla de espera mientras se resuelve la sesión o se redirige. Existe
 * como pieza propia porque ahora hay cuatro rutas que gatean por sesión y
 * cada una tenía su propio spinner suelto.
 */
export function FullScreenLoader() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-5"
      style={{ backgroundColor: "var(--surface)" }}
    >
      <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--brand-ink)" }} />
    </div>
  );
}
