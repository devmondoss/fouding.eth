"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatUsdc } from "@/lib/format";
import type { OpportunityStatus, Position } from "@/lib/types";

/* Paleta de gráfico validada (dataviz skill) — no confundir con los
   tokens de UI: --positive/--warning/--negative están apagados a
   propósito y no pasan el piso de croma como relleno de gráfico. */
const STATUS_CHART_CONFIG: ChartConfig = {
  review: { label: "En revisión", color: "var(--chart-review)" },
  funding: { label: "Levantando capital", color: "var(--chart-funding)" },
  active: { label: "Activa", color: "var(--chart-active)" },
  repaid: { label: "Pagada", color: "var(--chart-repaid)" },
  defaulted: { label: "En default", color: "var(--chart-defaulted)" },
};

export function StatusDonutChart({
  data,
}: {
  data: { status: OpportunityStatus; amount: number }[];
}) {
  const total = data.reduce((s, d) => s + d.amount, 0) || 1;

  return (
    <ChartContainer config={STATUS_CHART_CONFIG} className="h-[220px] w-full">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) =>
                `${formatUsdc(BigInt(Math.round(Number(value))))} USDC · ${Math.round(
                  (Number(value) / total) * 100,
                )}%`
              }
            />
          }
        />
        <Pie
          data={data}
          dataKey="amount"
          nameKey="status"
          innerRadius={56}
          outerRadius={82}
          paddingAngle={2}
          strokeWidth={2}
          stroke="var(--surface)"
          label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`}
          labelLine={false}
        >
          {data.map((d) => (
            <Cell key={d.status} fill={STATUS_CHART_CONFIG[d.status]?.color} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent />} />
      </PieChart>
    </ChartContainer>
  );
}

const CAPITAL_CHART_CONFIG: ChartConfig = {
  total: { label: "Capital invertido", color: "var(--brand-ink)" },
};

export function CapitalOverTimeChart({
  positions,
}: {
  positions: Position[];
}) {
  const data = useMemo(() => {
    const sorted = [...positions].sort(
      (a, b) => new Date(a.investedAt).getTime() - new Date(b.investedAt).getTime(),
    );
    let running = 0n;
    return sorted.map((p) => {
      running += p.principal;
      return {
        date: new Date(p.investedAt).toLocaleDateString("es-PE", {
          day: "2-digit",
          month: "short",
        }),
        total: Number(running) / 1e6,
      };
    });
  }, [positions]);

  if (data.length < 2) return null;

  return (
    <ChartContainer config={CAPITAL_CHART_CONFIG} className="h-[180px] w-full">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="capitalFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--brand-ink)" stopOpacity={0.18} />
            <stop offset="95%" stopColor="var(--brand-ink)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--text-low)" }}
          minTickGap={32}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="line"
              formatter={(value) =>
                `${formatUsdc(BigInt(Math.round(Number(value) * 1e6)))} USDC`
              }
            />
          }
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="var(--brand-ink)"
          strokeWidth={2}
          fill="url(#capitalFill)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
