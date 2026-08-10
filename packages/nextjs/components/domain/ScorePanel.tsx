import { ScoreBadge } from "./ScoreBadge";
import { Bloque, Cifra, Encabezado, FilaBarra } from "./FichaTab";
import { computeScore, GRADE_COLOR } from "@/lib/underwriting";
import { formatBps } from "@/lib/format";
import type { Opportunity } from "@/lib/types";

/**
 * El score es una función determinista y auditable, no una caja negra:
 * por eso el desglose se muestra completo.
 *
 * Completo no quería decir en tres líneas por factor. Cada uno gastaba
 * etiqueta, barra y detalle apilados —quince renglones para cinco
 * factores—, y la comparación entre ellos, que es de lo que sirve un
 * desglose, había que hacerla saltando de bloque en bloque. Ahora cada
 * factor es una fila y las barras quedan alineadas: cuál pesa y cuál
 * arrastra se ve de un vistazo.
 */
export function ScorePanel({ o }: { o: Opportunity }) {
  const s = computeScore(o);
  const color = GRADE_COLOR[s.grade];
  const diferencia = o.apyBps - s.suggestedApyBps;

  return (
    <div>
      <Encabezado>
        {/* El badge ya dice "Score crediticio — más alto es mejor" y la
            escala; el renglón de ayuda que había al lado repetía las dos
            cosas con otras palabras. */}
        <ScoreBadge score={s.score} grade={s.grade} />
        <Cifra
          label="Tasa del modelo"
          value={formatBps(s.suggestedApyBps)}
          nota="según este score"
        />
        <Cifra
          label="Tasa publicada"
          value={formatBps(o.apyBps)}
          nota={
            diferencia === 0
              ? "igual a la del modelo"
              : `${diferencia > 0 ? "+" : "−"}${Math.abs(diferencia / 100).toFixed(2)} pp ${diferencia > 0 ? "a favor tuyo" : "por debajo"}`
          }
          color={diferencia >= 0 ? "var(--text-hi)" : "var(--warning)"}
        />
      </Encabezado>

      <Bloque
        titulo="De dónde sale el score"
        aparte={
          <span className="text-[11px] text-low">
            cinco factores, pesos fijos y públicos
          </span>
        }
      >
        {s.factors.map((f) => (
          // 176px: los rótulos son el dato —"Cobertura de garantía",
          // "Ventas sobre monto pedido"— y a 118 se cortaban en puntos
          // suspensivos, que es perder justo lo que se está desglosando.
          <FilaBarra
            key={f.key}
            etiqueta={f.label}
            valor={`${f.points}/${f.max}`}
            fraccion={f.points / f.max}
            color={color}
            detalle={f.detail}
            anchoEtiqueta={176}
          />
        ))}
      </Bloque>
    </div>
  );
}
