import { MilestonePill } from "@/components/ui/Pill";
import { Bloque, Cifra, Encabezado } from "./FichaTab";
import { formatBps, formatDate, formatUsdc } from "@/lib/format";
import { escrowAmount, releasedAmount, releasedBps } from "@/lib/opportunity";
import type { Opportunity } from "@/lib/types";

const NODE = {
  pending: "var(--border-strong)",
  submitted: "var(--warning)",
  released: "var(--positive)",
  rejected: "var(--negative)",
} as const;

/**
 * El cronograma perdía media pantalla antes de llegar al cronograma: dos
 * tarjetas de métrica con borde de color y una línea de tiempo con 20px
 * de aire entre hitos. Las cifras subieron al encabezado y cada hito pasó
 * a ser una fila: número, qué tiene que pasar, cuánto libera y en qué
 * estado está. La línea vertical se queda —es lo que dice que hay un
 * orden— pero pegada al texto.
 */
export function MilestoneTimeline({ o }: { o: Opportunity }) {
  const liberado = releasedBps(o);

  return (
    <div>
      <Encabezado>
        <Cifra
          label="Retenido en contrato"
          value={formatUsdc(escrowAmount(o))}
          nota="USDC que la empresa todavía no toca"
          color="var(--brand-ink)"
        />
        <Cifra
          label="Entregado"
          value={formatUsdc(releasedAmount(o))}
          nota={`USDC · ${formatBps(liberado, 0)} del total`}
        />
      </Encabezado>

      <Bloque
        titulo="Hitos"
        aparte={
          <span className="num text-[11.5px] text-low">
            {o.milestones.filter((m) => m.status === "released").length} de{" "}
            {o.milestones.length} desembolsados
          </span>
        }
      >
        <ol className="flex flex-col">
          {o.milestones.map((m, i) => {
            const color = NODE[m.status];
            const last = i === o.milestones.length - 1;

            return (
              <li key={m.index} className="relative flex gap-3 pb-3 last:pb-0">
                {!last && (
                  <span
                    className="absolute bottom-0 left-[9px] top-5 w-px"
                    style={{ backgroundColor: "var(--border)" }}
                  />
                )}

                {/* El nodo liberado llevaba un check en vez del número, así
                    que el hito 3 dejaba de llamarse 3 justo cuando se
                    cumplía. El número se queda y el relleno dice el estado,
                    que además la píldora nombra al lado. */}
                <span
                  className="relative z-10 mt-[1px] flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: color,
                    backgroundColor:
                      m.status === "released" ? color : "var(--surface)",
                  }}
                >
                  <span
                    className="num text-[9.5px] font-bold"
                    style={{ color: m.status === "released" ? "#FFFFFF" : color }}
                  >
                    {m.index + 1}
                  </span>
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[12.5px] font-semibold text-hi">
                      {m.title}
                    </span>
                    <span className="num shrink-0 text-[12.5px] font-semibold text-hi">
                      {formatUsdc((o.raisedAmount * BigInt(m.releaseBps)) / 10000n)}
                    </span>
                  </div>

                  <p className="mt-0.5 text-[12px] leading-snug text-mid">
                    {m.description}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <MilestonePill status={m.status} />
                    <span className="num text-[11px] text-low">
                      {formatBps(m.releaseBps, 0)} del capital
                    </span>
                    {m.evidenceName && (
                      <span className="truncate text-[11px] text-low">
                        {m.evidenceName}
                      </span>
                    )}
                    {m.releasedAt && (
                      <span className="text-[11px] text-low">
                        {formatDate(m.releasedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Bloque>
    </div>
  );
}
