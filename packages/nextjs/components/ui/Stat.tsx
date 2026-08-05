import type { ReactNode } from "react";

/** Fila etiqueta → valor. La cifra siempre en mono tabular. */
export function Row({
  label,
  value,
  accent,
  strong,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
      <span className="shrink-0 text-[13px] text-mid">{label}</span>
      <span
        className="num whitespace-nowrap text-right text-[13px]"
        style={{
          color: accent ?? "var(--text-hi)",
          fontWeight: strong ? 600 : 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** Bloque de métrica: usado en las tarjetas de resumen. */
export function Metric({
  label,
  value,
  unit,
  accent,
  size = "md",
}: {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  accent?: string;
  size?: "sm" | "md" | "lg";
}) {
  const s = { sm: "text-[16px]", md: "text-[22px]", lg: "text-[30px]" }[size];
  return (
    <div>
      <div className="label">{label}</div>
      <div
        className={`num mt-1 font-semibold leading-tight ${s}`}
        style={{ color: accent ?? "var(--text-hi)" }}
      >
        {value}
      </div>
      {unit && <div className="mt-0.5 text-[12px] text-low">{unit}</div>}
    </div>
  );
}

export function MetricCard(props: Parameters<typeof Metric>[0]) {
  return (
    <div className="card px-4 py-3.5">
      <Metric {...props} />
    </div>
  );
}
