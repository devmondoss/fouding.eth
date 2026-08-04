import { MiniBar } from "@/components/ui/ProgressBar";
import { ScoreBadge } from "./ScoreBadge";
import { computeScore, GRADE_COLOR } from "@/lib/underwriting";
import { formatBps } from "@/lib/format";
import type { Opportunity } from "@/lib/types";

/**
 * El score es una función determinista y auditable, no una caja negra: por
 * eso el desglose se muestra completo.
 */
export function ScorePanel({ o }: { o: Opportunity }) {
  const s = computeScore(o);
  const color = GRADE_COLOR[s.grade];

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="h3">Score crediticio</h3>
          <p className="mt-0.5 text-[11.5px] text-low">
            0 a 1000 · más alto significa menor riesgo, no más riesgo
          </p>
        </div>
        <ScoreBadge score={s.score} grade={s.grade} />
      </div>

      <div className="mt-5 flex flex-col gap-3.5">
        {s.factors.map((f) => (
          <div key={f.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12.5px] text-hi">{f.label}</span>
              <span className="num shrink-0 text-[12px] text-low">
                {f.points}/{f.max}
              </span>
            </div>
            <div className="mt-1.5">
              <MiniBar pct={(f.points / f.max) * 100} color={color} />
            </div>
            <div className="mt-1 text-[11.5px] text-low">{f.detail}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <div>
          <div className="text-[12.5px] font-medium text-hi">
            Tasa sugerida por el modelo
          </div>
          <div className="text-[11.5px] text-low">
            Rentabilidad publicada: {formatBps(o.apyBps)}
          </div>
        </div>
        <span className="num text-[19px] font-bold text-hi">
          {formatBps(s.suggestedApyBps)}
        </span>
      </div>
    </section>
  );
}
