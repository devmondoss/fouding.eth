/**
 * Avance de recaudación. El relleno usa --brand-strong, no --brand:
 * chartreuse contra la pista --border mide 1.10:1, así que la barra más
 * repetida del producto —una por tarjeta, más la del panel de inversión—
 * era invisible, incluso de cerca. Ver globals.css §Marca.
 */
export function ProgressBar({
  bps,
  height = 6,
  color = "var(--brand-strong)",
}: {
  bps: number;
  height?: number;
  color?: string;
}) {
  const pct = Math.min(100, Math.max(0, bps / 100));
  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ height, backgroundColor: "var(--border)" }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full"
      style={{ backgroundColor: "var(--border)" }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{
          width: `${Math.min(100, Math.max(0, pct))}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}
