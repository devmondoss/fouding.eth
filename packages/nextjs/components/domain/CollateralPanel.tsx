import { Row } from "@/components/ui/Stat";
import { Bloque, Cifra, Encabezado, Hecho } from "./FichaTab";
import { COLLATERAL_LABEL, coverageBps } from "@/lib/opportunity";
import { formatBps, formatRatio, formatUsdc } from "@/lib/format";
import { lossBufferBps } from "@/lib/underwriting";
import type { Opportunity } from "@/lib/types";

/**
 * La tasación se muestra subordinada a propósito: el criterio de crédito
 * es el valor NETO recuperable, nunca el valor en libros (start.md
 * §Política).
 *
 * Antes esta pestaña abría con un recuadro de color y un 1.83x de 26px
 * para decir "suficiente" — tres canales (borde, tamaño, palabra) para un
 * solo dato, y una tarjeta entera de alto. Ahora la cobertura es una
 * cifra del encabezado y el espacio se lo lleva lo que realmente hay que
 * revisar: de dónde sale ese valor y si la garantía es ejecutable.
 */
export function CollateralPanel({ o }: { o: Opportunity }) {
  const c = o.collateral;
  const cov = coverageBps(o);
  const ok = cov >= 10000;
  const castigo = (c.appraisedValue * BigInt(c.haircutBps)) / 10000n;
  const colchon = lossBufferBps(o);
  const inscrita = Boolean(c.registryEntry);

  return (
    <div>
      <Encabezado>
        <Cifra
          label="Cobertura"
          value={formatRatio(cov)}
          nota={ok ? "cubre lo solicitado" : "no cubre lo solicitado"}
          color={ok ? "var(--positive)" : "var(--negative)"}
        />
        <Cifra
          label="Valor neto recuperable"
          value={formatUsdc(c.netRecoverableValue)}
          nota="USDC, ya castigado"
        />
        <Cifra
          label="Margen antes de perder"
          value={colchon > 0 ? `−${formatBps(colchon, 0)}` : "sin margen"}
          nota="puede caer el activo"
          color={colchon > 0 ? "var(--text-hi)" : "var(--negative)"}
        />
      </Encabezado>

      <Bloque titulo="El activo" aparte={<Etiqueta texto={COLLATERAL_LABEL[c.kind]} />}>
        <p className="text-[13px] leading-relaxed text-mid">{c.description}</p>
      </Bloque>

      {/* La resta completa, que es lo que hace auditable la cifra de
          arriba. Tres filas en vez de tres tarjetas. */}
      <Bloque titulo="Cómo se llega al valor neto">
        <Row
          label="Tasación del activo"
          value={formatUsdc(c.appraisedValue)}
          accent="var(--text-mid)"
        />
        <Row
          label={`Castigo por ser ${COLLATERAL_LABEL[c.kind].toLowerCase()} (${formatBps(c.haircutBps, 0)})`}
          value={`−${formatUsdc(castigo)}`}
          accent="var(--warning)"
        />
        <Row
          label="Valor neto recuperable"
          value={`${formatUsdc(c.netRecoverableValue)} USDC`}
          accent="var(--positive)"
          strong
        />
      </Bloque>

      {/* Que la garantía valga no sirve de nada si no se puede ejecutar:
          eso lo deciden la inscripción y los gravámenes previos, que
          estaban al final y en gris. */}
      <Bloque titulo="Si hay que ejecutarla">
        <Hecho
          texto={c.registryEntry ?? "Sin inscripción registral"}
          veredicto={
            inscrita
              ? "inscrita y oponible frente a terceros"
              : "la ejecución es más lenta e incierta"
          }
          tono={inscrita ? "positive" : "negative"}
        />
        <Hecho
          texto={
            c.liens.length > 0
              ? c.liens.join(" · ")
              : "Sin gravámenes previos sobre el activo"
          }
          veredicto={
            c.liens.length > 0
              ? "cobran antes que esta operación"
              : "el recupero no se reparte con nadie"
          }
          tono={c.liens.length > 0 ? "warning" : "positive"}
        />
        <Hecho
          texto={c.titleVerified ? "Titularidad verificada" : "Titularidad sin verificar"}
          veredicto={
            c.titleVerified
              ? "el activo es de la empresa"
              : "no se confirmó quién es el dueño"
          }
          tono={c.titleVerified ? "positive" : "warning"}
        />
      </Bloque>
    </div>
  );
}

function Etiqueta({ texto }: { texto: string }) {
  return (
    <span className="rounded-[var(--r-pill)] border border-border bg-surface-soft px-2 py-[2px] text-[11px] text-mid">
      {texto}
    </span>
  );
}
