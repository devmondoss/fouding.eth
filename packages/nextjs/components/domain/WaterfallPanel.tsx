import { CheckCircle2, Circle } from "lucide-react";
import { formatBps, formatUsdc } from "@/lib/format";
import { expectedInterest } from "@/lib/opportunity";
import { DEFAULT_COSTS, waterfallForOpportunity } from "@/lib/underwriting";
import type { Opportunity } from "@/lib/types";

/**
 * Dos modos: sin default muestra el ORDEN de la cascada; con default muestra
 * el reparto REAL de lo recuperado.
 */
export function WaterfallPanel({ o }: { o: Opportunity }) {
  const executed = o.status === "defaulted" && o.recoveredAmount != null;
  const recovered = o.recoveredAmount ?? 0n;
  const result = waterfallForOpportunity(o, recovered);

  const principal = o.raisedAmount;
  const legal = (principal * BigInt(DEFAULT_COSTS.legalBps)) / 10000n;
  const servicing = (principal * BigInt(DEFAULT_COSTS.servicingBps)) / 10000n;
  const totalDue = legal + servicing + principal + expectedInterest(o);

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="h3">Prelación de pagos ante incumplimiento</h3>
          {executed && (
            <p className="mt-1 text-[13px] text-mid">
              Distribución sobre el monto recuperado
            </p>
          )}
        </div>
        {executed && (
          <div className="text-right">
            <div className="label">Recuperado</div>
            <div className="num text-[17px] font-semibold text-hi">
              {formatUsdc(recovered)}
            </div>
          </div>
        )}
      </div>

      <ol className="mt-4 flex flex-col gap-2">
        {result.tiers.map((t) => {
          const mine = t.order === 3 || t.order === 4;
          const share = totalDue > 0n ? Number((t.due * 10000n) / totalDue) : 0;
          const fill = t.due > 0n ? Number((t.paid * 10000n) / t.due) : 10000;

          return (
            <li
              key={t.order}
              className="rounded-[var(--r-panel)] border px-4 py-3"
              style={{
                borderColor: mine ? "var(--brand-ink)" : "var(--border)",
                backgroundColor: mine ? "var(--surface)" : "var(--surface-soft)",
              }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-2.5">
                  <span className="num text-[11.5px] text-low">{t.order}</span>
                  <div>
                    <div className="text-[12.5px] font-semibold text-hi">
                      {t.label}
                      {mine && (
                        <span
                          className="ml-2 text-[11px] font-medium"
                          style={{ color: "var(--brand-ink)" }}
                        >
                          tramo del inversionista
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-low">{t.note}</div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="num text-[13px] font-semibold text-hi">
                    {executed ? formatUsdc(t.paid) : formatUsdc(t.due)}
                  </div>
                  {executed && t.paid < t.due && (
                    <div
                      className="num text-[11px]"
                      style={{ color: "var(--negative)" }}
                    >
                      de {formatUsdc(t.due)} · {formatBps(fill, 0)}
                    </div>
                  )}
                </div>
              </div>

              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: "rgba(16,24,40,0.08)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, share / 100)}%`,
                    backgroundColor: mine ? "var(--brand-strong)" : "var(--text-low)",
                    opacity: executed && t.paid === 0n ? 0.3 : 1,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ol>

      {executed && (
        <>
          <div
            className="mt-4 flex items-center justify-between rounded-[var(--r-panel)] border px-4 py-3.5"
            style={{
              borderColor: "var(--negative)",
              backgroundColor: "var(--surface)",
            }}
          >
            <div className="text-[13px] font-semibold text-hi">
              Recupero de la inversión
            </div>
            <span
              className="num text-[26px] font-bold"
              style={{ color: "var(--negative)" }}
            >
              {formatBps(result.investorRecoveryBps, 1)}
            </span>
          </div>

          {/* La historia del default terminaba acá, en un porcentaje rojo.
              El dato estaba completo y la persona quedaba sola: qué pasa
              ahora, cuánto falta, quién decide, y qué parte de esto la
              garantiza el contrato y qué parte un tercero. Es el
              diferenciador declarado del producto; merece el mismo cuidado
              que el camino feliz. */}
          <div className="mt-3 rounded-[var(--r-panel)] border border-border p-4">
            <h4 className="h3">Qué sigue</h4>
            <ol className="mt-2.5 flex flex-col gap-2.5">
              <NextStep
                done
                title="Se declaró el incumplimiento"
                detail="El vault quedó cerrado a aportes nuevos. Tu posición sigue existiendo y no se puede diluir."
              />
              <NextStep
                done={recovered > 0n}
                title="Ejecución de la garantía"
                detail="La liquidación del activo ocurre fuera de la cadena, a través del vehículo legal que la tiene inscrita. El contrato no puede ejecutarla por sí solo."
              />
              <NextStep
                done={recovered > 0n}
                title="Ingreso del recupero al contrato"
                detail={
                  recovered > 0n
                    ? `Ingresaron ${formatUsdc(recovered)} USDC. El reparto de arriba ya se ejecutó onchain con esa cifra.`
                    : "Cuando el recupero ingrese, el contrato reparte automáticamente según el orden de arriba. Nadie decide el orden en ese momento: ya estaba escrito."
                }
              />
              <NextStep
                done={false}
                title="Cobro de lo que te corresponde"
                detail="Tu parte queda disponible para reclamar desde el portafolio. Puede ser menor a tu capital: el recupero de una garantía es parcial más veces de lo que es total."
              />
            </ol>
            <p className="mt-3.5 border-t border-border pt-3 text-[11.5px] leading-relaxed text-low">
              Los plazos de una ejecución dependen del proceso registral y
              judicial peruano, no del contrato. No prometemos una fecha
              porque no la controlamos.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

/** Un paso de la ejecución, con su estado. El punto lleva ícono, no solo
 *  color: el estado de un cobro no puede depender del tono. */
function NextStep({
  done,
  title,
  detail,
}: {
  done: boolean;
  title: string;
  detail: string;
}) {
  return (
    <li className="flex gap-2.5">
      {done ? (
        <CheckCircle2
          className="mt-px h-4 w-4 shrink-0"
          style={{ color: "var(--positive)" }}
        />
      ) : (
        <Circle className="mt-px h-4 w-4 shrink-0 text-low" />
      )}
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold text-hi">{title}</div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-mid">{detail}</p>
      </div>
    </li>
  );
}
