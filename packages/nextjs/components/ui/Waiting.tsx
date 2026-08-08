/**
 * Espera. Reemplaza a `Loader2` girando, que aparecía en once sitios con
 * cuatro tamaños distintos. La regla que barre es el mismo gesto que el
 * sistema ya usa para avance y dirección (ver globals.css §ESPERA).
 *
 * Lleva `label` porque un lector de pantalla necesita saber qué se está
 * esperando, y porque cuando hay sitio para la palabra, la palabra va.
 */
export function Waiting({
  label = "Cargando",
  showLabel = false,
  width,
}: {
  label?: string;
  showLabel?: boolean;
  width?: number;
}) {
  return (
    <span
      role="status"
      className={
        showLabel
          ? "inline-flex flex-col items-center gap-2.5"
          : "inline-flex items-center"
      }
    >
      <span className="waiting" style={width ? { width } : undefined} />
      <span
        className={showLabel ? "text-[12px] text-low" : "sr-only"}
        style={showLabel ? undefined : SR_ONLY}
      >
        {label}
      </span>
    </span>
  );
}

/** Pantalla completa mientras se resuelve la sesión o se redirige. */
export function WaitingScreen({ label }: { label?: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-5"
      style={{ backgroundColor: "var(--surface)" }}
    >
      <Waiting label={label} />
    </div>
  );
}

const SR_ONLY = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;
