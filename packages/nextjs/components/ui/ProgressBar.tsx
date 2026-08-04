export function ProgressBar({
  bps,
  height = 6,
  color = "var(--brand)",
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
