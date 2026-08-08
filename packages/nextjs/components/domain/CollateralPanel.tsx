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
        {/* El escudo era el tercer canal: borde, cifra de 26px y glifo,
            todos diciendo lo mismo. La palabra que faltaba —si la cobertura
            alcanza o no— ahora está escrita. */}
        <div>
          <div className="text-[13px] font-semibold text-hi">
            Cobertura de la garantía
          </div>
          <div
            className="text-[12px] font-medium"
            style={{ color: ok ? "var(--positive)" : "var(--negative)" }}
          >
            {ok ? "Suficiente" : "Insuficiente"}
            <span className="num font-normal text-mid">
              {" "}
              · valor recuperable sobre monto solicitado
            </span>
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

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
        <div>
          <div className="text-[12.5px] font-medium text-hi">
            {c.registryEntry ?? "Garantía sin inscripción registral"}
          </div>
          <div
            className="text-[12px]"
            style={{
              color: c.registryEntry ? "var(--positive)" : "var(--negative)",
            }}
          >
            {c.registryEntry
              ? "Inscrita y oponible frente a terceros"
              : "Sin inscripción, la ejecución es más lenta e incierta"}
          </div>
        </div>

        {c.liens.length > 0 && (
          <div>
            <div
              className="text-[12.5px] font-medium"
              style={{ color: "var(--warning)" }}
            >
              Gravámenes previos
            </div>
            {c.liens.map((l) => (
              <div key={l} className="text-[12px] text-low">
                {l}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
