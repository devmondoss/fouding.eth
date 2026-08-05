import { AlertTriangle, FileCheck2, ShieldCheck, ShieldX } from "lucide-react";
import { Row } from "@/components/ui/Stat";
import { Tag } from "@/components/ui/Pill";
import { COLLATERAL_LABEL, coverageBps } from "@/lib/opportunity";
import { formatBps, formatRatio, formatUsdc } from "@/lib/format";
import type { Opportunity } from "@/lib/types";

/**
 * La tasación se muestra subordinada a propósito: el criterio de crédito es
 * el valor NETO recuperable, nunca el valor en libros (start.md §Política).
 */
export function CollateralPanel({ o }: { o: Opportunity }) {
  const c = o.collateral;
  const cov = coverageBps(o);
  const ok = cov >= 10000;

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="h3">Garantía</h3>
          <p className="mt-1 text-[13px] text-mid">{c.description}</p>
        </div>
        <Tag label={COLLATERAL_LABEL[c.kind]} />
      </div>

      {/* Cobertura */}
      <div
        className="mt-4 flex items-center justify-between rounded-[var(--r-panel)] border px-4 py-3.5"
        style={{
          borderColor: ok ? "var(--positive)" : "var(--negative)",
          backgroundColor: "var(--surface)",
        }}
      >
        <div className="flex items-center gap-2.5">
          {ok ? (
            <ShieldCheck className="h-5 w-5" style={{ color: "var(--positive)" }} />
          ) : (
            <ShieldX className="h-5 w-5" style={{ color: "var(--negative)" }} />
          )}
          <div>
            <div className="text-[13px] font-semibold text-hi">
              Cobertura de la garantía
            </div>
            <div className="num text-[12px] text-mid">
              Valor recuperable / monto solicitado
            </div>
          </div>
        </div>
        <span
          className="num text-[26px] font-bold"
          style={{ color: ok ? "var(--positive)" : "var(--negative)" }}
        >
          {formatRatio(cov)}
        </span>
      </div>

      <div className="mt-4">
        <Row
          label="Tasación del activo"
          value={formatUsdc(c.appraisedValue)}
          accent="var(--text-mid)"
        />
        <Row
          label={`Castigo por tipo de activo (${formatBps(c.haircutBps, 0)})`}
          value={`−${formatUsdc((c.appraisedValue * BigInt(c.haircutBps)) / 10000n)}`}
          accent="var(--warning)"
        />
        <Row
          label="Valor neto recuperable"
          value={`${formatUsdc(c.netRecoverableValue)} USDC`}
          accent="var(--positive)"
          strong
        />
      </div>

      <div className="mt-4 flex flex-col gap-2.5 border-t border-border pt-4">
        <div className="flex items-start gap-2.5">
          <FileCheck2
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{
              color: c.registryEntry ? "var(--positive)" : "var(--negative)",
            }}
          />
          <div>
            <div className="text-[12.5px] font-medium text-hi">
              {c.registryEntry ?? "Garantía sin inscripción registral"}
            </div>
            <div className="text-[12px] text-low">
              {c.registryEntry
                ? "Inscrita y oponible frente a terceros"
                : "Sin inscripción la ejecución es más lenta e incierta"}
            </div>
          </div>
        </div>

        {c.liens.length > 0 && (
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: "var(--warning)" }}
            />
            <div>
              <div className="text-[12.5px] font-medium text-hi">
                Gravámenes previos
              </div>
              {c.liens.map((l) => (
                <div key={l} className="text-[12px] text-low">
                  {l}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
