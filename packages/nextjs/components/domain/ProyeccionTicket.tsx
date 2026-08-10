"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatUsdc } from "@/lib/format";
import { projectedReturn } from "@/lib/opportunity";
import type { Opportunity } from "@/lib/types";

/**
 * La proyección de un ticket: dónde está tu dinero cada mes del plazo.
 *
 * Las cifras solas —"pones 2,500, recibes 2,912.5"— dicen el principio y el
 * final y se saltan lo único que distingue a esta operación de un depósito:
 * que el capital NO se mueve durante todo el plazo (queda retenido en el
 * contrato y sale por hitos) y que lo que crece encima es el interés, que se
 * cobra recién al vencimiento. Eso es una forma, no un número: una banda
 * quieta y otra que sube sobre ella.
 *
 * Dos series, dos colores del par --chart-capital / --chart-interes. No usa
 * los --chart-* de estado: ver globals.css.
 *
 * Los hitos NO se marcan en el eje. El expediente dice cuánto libera cada
 * uno (`releaseBps`) pero no en qué mes, y ponerlos a intervalos regulares
 * sería inventar un calendario que nadie pactó.
 */

const CONFIG: ChartConfig = {
  capital: { label: "Tu capital", color: "var(--chart-capital)" },
  interes: { label: "Interés devengado", color: "var(--chart-interes)" },
};

export function ProyeccionTicket({
  o,
  ticket,
}: {
  o: Opportunity;
  /** El monto sobre el que se proyecta, en unidades del token (6 dec). */
  ticket: bigint;
}) {
  const { data, ticks } = useMemo(() => {
    const meses = Math.max(1, o.termMonths);
    const capital = Number(ticket) / 1e6;
    const interesTotal = Number(projectedReturn(o, ticket)) / 1e6;

    // Un punto por mes hasta doce; de ahí en adelante se muestrea para no
    // amontonar marcas que nadie va a leer. El último punto es siempre el
    // vencimiento: es la cifra que importa y no puede quedar interpolada.
    const paso = meses <= 12 ? 1 : Math.ceil(meses / 12);
    const puntos: number[] = [];
    for (let m = 0; m <= meses; m += paso) puntos.push(m);
    if (puntos[puntos.length - 1] !== meses) puntos.push(meses);

    return {
      data: puntos.map((m) => ({
        mes: m,
        capital,
        // Tasa fija, repago bullet: el interés se devenga parejo a lo largo
        // del plazo y se cobra entero al final.
        interes: (interesTotal * m) / meses,
      })),
      // Los extremos se rotulan siempre. Dejados al espaciado automático,
      // recharts descartaba justo el 0 —"hoy", el momento en que sale el
      // dinero— y el eje empezaba a mitad del plazo.
      ticks: [0, Math.round(meses / 2), meses],
    };
  }, [o, ticket]);

  return (
    <ChartContainer config={CONFIG} className="h-[136px] w-full">
      {/* Aire a los costados para que quepan los rótulos de los extremos:
          sin él recharts descarta el del mes 0 —"hoy"— porque su texto se
          sale del área de trazado. */}
      <AreaChart data={data} margin={{ left: 0, right: 20, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="mes"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "var(--text-low)" }}
          ticks={ticks}
          tickFormatter={(m) => (m === 0 ? "hoy" : `mes ${m}`)}
        />
        {/* Sin escala, dos bandas de colores son una ilustración: no se
            puede leer cuánto vale el tramo de interés ni comparar un mes
            con otro. El eje es lo que convierte el dibujo en una medición. */}
        <YAxis
          width={54}
          tickLine={false}
          axisLine={false}
          tickCount={4}
          tick={{ fontSize: 11, fill: "var(--text-low)" }}
          tickFormatter={(v) =>
            formatUsdc(BigInt(Math.round(Number(v) * 1e6)), 0)
          }
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(m) => (Number(m) === 0 ? "Hoy" : `Mes ${m}`)}
              formatter={(value) =>
                `${formatUsdc(BigInt(Math.round(Number(value) * 1e6)), 2)} USDC`
              }
            />
          }
        />
        {/* Rellenos translúcidos y contorno del color propio de cada serie.
            Opacos —que es lo que pide el patrón apilado por defecto— tapan
            la retícula, y una gráfica de la que no se ve la escala detrás
            deja de medir nada. El contorno de cada tramo es el que separa
            uno del otro; no hace falta un tercer trazo del color del fondo. */}
        <Area
          type="linear"
          dataKey="capital"
          stackId="ticket"
          fill="var(--color-capital)"
          fillOpacity={0.2}
          stroke="var(--color-capital)"
          strokeWidth={2}
          isAnimationActive={false}
        />
        <Area
          type="linear"
          dataKey="interes"
          stackId="ticket"
          fill="var(--color-interes)"
          fillOpacity={0.24}
          stroke="var(--color-interes)"
          strokeWidth={2}
          isAnimationActive={false}
        />
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );
}
