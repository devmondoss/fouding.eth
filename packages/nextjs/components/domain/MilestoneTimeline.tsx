import { MilestonePill } from "@/components/ui/Pill";
import { Metric } from "@/components/ui/Stat";
import { formatBps, formatDate, formatUsdc } from "@/lib/format";
import { escrowAmount, releasedAmount, releasedBps } from "@/lib/opportunity";
import type { Opportunity } from "@/lib/types";

const NODE = {
  pending: "var(--border-strong)",
  submitted: "var(--warning)",
  released: "var(--positive)",
  rejected: "var(--negative)",
} as const;

export function MilestoneTimeline({ o }: { o: Opportunity }) {
  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="h3">Cronograma de desembolsos</h3>
        <span className="num text-[13px] text-mid">
          {formatBps(releasedBps(o), 0)} liberado
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          className="rounded-[var(--r-panel)] border px-4 py-3"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--brand-ink)",
          }}
        >
          <Metric
            label="Retenido en contrato"
            value={formatUsdc(escrowAmount(o))}
            unit="USDC"
            size="sm"
            accent="var(--brand-ink)"
          />
        </div>
        <div
          className="rounded-[var(--r-panel)] px-4 py-3"
          style={{ backgroundColor: "var(--surface-soft)" }}
        >
          <Metric
            label="Entregado a la empresa"
            value={formatUsdc(releasedAmount(o))}
            unit="USDC"
            size="sm"
          />
        </div>
      </div>

      <ol className="mt-5 flex flex-col">
        {o.milestones.map((m, i) => {
          const color = NODE[m.status];
          const last = i === o.milestones.length - 1;

          return (
            <li key={m.index} className="relative flex gap-4 pb-5 last:pb-0">
              {!last && (
                <span
                  className="absolute left-[11px] top-6 bottom-0 w-px"
                  style={{ backgroundColor: "var(--border)" }}
                />
              )}

              <span
                className="relative z-10 mt-0.5 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full border-2"
                style={{
                  borderColor: color,
                  backgroundColor:
                    m.status === "released" ? color : "var(--surface)",
                }}
              >
                {/* El nodo liberado llevaba un check en vez del número, así
                    que el hito 3 dejaba de llamarse 3 justo cuando se
                    cumplía. El orden es el dato del cronograma: el número se
                    queda y el relleno dice el estado, que además la píldora
                    nombra al lado. */}
                <span
                  className="num text-[10px] font-bold"
                  style={{
                    color: m.status === "released" ? "#FFFFFF" : color,
                  }}
                >
                  {m.index + 1}
                </span>
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-hi">
                      {m.title}
                    </div>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-mid">
                      {m.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <MilestonePill status={m.status} />
                    <span className="num text-[12.5px] font-semibold text-hi">
                      {formatUsdc(
                        (o.raisedAmount * BigInt(m.releaseBps)) / 10000n,
                      )}
                    </span>
                  </div>
                </div>

                {(m.evidenceName || m.releasedAt) && (
                  <div className="mt-1.5 flex items-center gap-3 text-[11.5px] text-low">
                    {m.evidenceName && <span>Evidencia: {m.evidenceName}</span>}
                    {m.releasedAt && <span>{formatDate(m.releasedAt)}</span>}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
