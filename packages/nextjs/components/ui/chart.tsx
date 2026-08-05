"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";

/**
 * Envoltorio de Recharts al estilo shadcn/ui: un ChartConfig declarativo
 * (label + color por serie) que alimenta tooltip, leyenda y CSS vars por
 * serie, para no repetir colores a mano en cada gráfico. Es el único punto
 * de entrada a gráficos de la plataforma — ver design-system.md §9.
 */

export type ChartConfig = Record<
  string,
  {
    label: React.ReactNode;
    icon?: React.ComponentType;
    color?: string;
  }
>;

type ChartContextProps = { config: ChartConfig };

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("Los subcomponentes de Chart van dentro de <ChartContainer>");
  }
  return context;
}

function ChartContainer({
  id,
  className = "",
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >["children"];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={`aspect-auto [&_.recharts-cartesian-axis-tick_text]:fill-low [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden ${className}`}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const entries = Object.entries(config).filter(([, cfg]) => cfg.color);
  if (!entries.length) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart="${id}"]{${entries
          .map(([key, cfg]) => `--color-${key}: ${cfg.color};`)
          .join("")}}`,
      }}
    />
  );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

type TooltipItem = {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: unknown;
};

function ChartTooltipContent({
  active,
  payload,
  label,
  hideLabel = false,
  hideIndicator = false,
  indicator = "dot",
  formatter,
  labelFormatter,
  className = "",
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: "line" | "dot" | "dashed";
  formatter?: (
    value: number | string,
    name: string | number | undefined,
    item: TooltipItem,
    index: number,
    payload: unknown,
  ) => React.ReactNode;
  labelFormatter?: (
    label: string | number,
    payload: TooltipItem[],
  ) => React.ReactNode;
  className?: string;
}) {
  const { config } = useChart();

  if (!active || !payload?.length) return null;

  return (
    <div
      className={`grid min-w-[9rem] gap-1.5 rounded-[var(--r-panel)] border border-border px-2.5 py-1.5 text-[12px] shadow-[var(--shadow-md)] ${className}`}
      style={{ backgroundColor: "var(--surface)" }}
    >
      {!hideLabel && label != null && (
        <div className="font-medium text-hi">
          {labelFormatter ? labelFormatter(label, payload) : label}
        </div>
      )}
      <div className="grid gap-1">
        {payload.map((item, i) => {
          const key = String(item.dataKey ?? item.name ?? "value");
          const cfg = config[key];
          const color = item.color ?? cfg?.color;

          return (
            <div
              key={item.dataKey ?? i}
              className="flex w-full items-center gap-2"
            >
              {!hideIndicator && (
                <span
                  className={
                    indicator === "dot"
                      ? "h-2 w-2 shrink-0 rounded-full"
                      : indicator === "line"
                        ? "h-2.5 w-[3px] shrink-0"
                        : "h-0 w-2.5 shrink-0 border-[1.5px] border-dashed"
                  }
                  style={{
                    backgroundColor: indicator === "dashed" ? undefined : color,
                    borderColor: indicator === "dashed" ? color : undefined,
                  }}
                />
              )}
              <div className="flex flex-1 items-center justify-between gap-3 leading-none">
                <span className="text-mid">{cfg?.label ?? item.name}</span>
                {item.value != null && (
                  <span className="num font-semibold text-hi">
                    {formatter
                      ? formatter(item.value, item.name, item, i, item.payload)
                      : item.value.toLocaleString("es-PE")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChartLegend = RechartsPrimitive.Legend;

function ChartLegendContent({
  payload,
  className = "",
}: {
  payload?: readonly { value?: string; color?: string; dataKey?: string }[];
  className?: string;
}) {
  const { config } = useChart();
  if (!payload?.length) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-3 ${className}`}
    >
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.value ?? "");
        const cfg = config[key];
        return (
          <div key={key} className="flex items-center gap-1.5 text-[11.5px] text-mid">
            <span
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: item.color ?? cfg?.color }}
            />
            {cfg?.label ?? item.value}
          </div>
        );
      })}
    </div>
  );
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  useChart,
};
