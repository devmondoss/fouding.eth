"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CollateralPanel } from "@/components/domain/CollateralPanel";
import { InvestPanel } from "@/components/domain/InvestPanel";
import { MilestoneTimeline } from "@/components/domain/MilestoneTimeline";
import { OrderBook } from "@/components/domain/OrderBook";
import { PassportPanel } from "@/components/domain/PassportPanel";
import { ScorePanel } from "@/components/domain/ScorePanel";
import { WaterfallPanel } from "@/components/domain/WaterfallPanel";
import { initials } from "@/components/domain/OpportunityCard";
import { StatusPill, Tag } from "@/components/ui/Pill";
import { Row } from "@/components/ui/Stat";
import { usePlatform } from "@/lib/data/store";
import { daysUntil, formatBps, formatRatio, formatUsdc, usdc } from "@/lib/format";
import { useFocusTrap, useLayerKeys } from "@/lib/keyboard";
import { dialog, scrim, sheetUp, slide, T } from "@/lib/motion";
import { useEsHoja } from "@/lib/useViewport";
import { compararConElCatalogo, type Comparativa } from "@/lib/benchmark";
import {
  coverageBps,
  creditInterest,
  issuerTrackRecord,
  projectedReturn,
} from "@/lib/opportunity";
import { lossBufferBps, recoveryOnDefaultBps } from "@/lib/underwriting";
import type { Opportunity } from "@/lib/types";

const TRACK_TONE_COLOR = {
  neutral: "var(--text-mid)",
  positive: "var(--positive)",
  warning: "var(--warning)",
  negative: "var(--negative)",
} as const;

const STEPS = [
  { key: "resumen", label: "Resumen" },
  { key: "garantia", label: "Garantía" },
  { key: "desembolsos", label: "Desembolsos" },
  { key: "calificacion", label: "Calificación crediticia" },
  { key: "empresa", label: "Empresa" },
  { key: "orden", label: "Prelación de pagos" },
  { key: "mercado", label: "Mercado secundario" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export function DetailOverlay({
  o,
  onClose,
  onOpenFunds,
  onRequestAccess,
  onOpenPortfolio,
}: {
  o: Opportunity;
  onClose: () => void;
  onOpenFunds: () => void;
  onRequestAccess: () => void;
  onOpenPortfolio: () => void;
}) {
  const [step, setStep] = useState<StepKey>("resumen");
  const [dir, setDir] = useState(1);

  function go(next: StepKey) {
    const from = STEPS.findIndex((s) => s.key === step);
    const to = STEPS.findIndex((s) => s.key === next);
    setDir(to > from ? 1 : -1);
    setStep(next);
  }

  // La ficha solo escucha mientras sea la capa de arriba: si abre el modal
  // de confirmación encima, Escape cierra ese modal y la ficha se queda.
  const i = STEPS.findIndex((s) => s.key === step);
  useLayerKeys({
    onEscape: onClose,
    onPrev: () => i > 0 && go(STEPS[i - 1].key),
    onNext: () => i < STEPS.length - 1 && go(STEPS[i + 1].key),
  });

  const panelRef = useFocusTrap<HTMLDivElement>(true);
  const esHoja = useEsHoja();

  return (
    <motion.div
      variants={scrim}
      initial="hidden"
      animate="show"
      exit="exit"
      className="fixed inset-0 z-50 flex flex-col lg:p-6"
      style={{ backgroundColor: "rgba(16,24,40,0.35)" }}
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${o.projectTitle} — ${o.company.name}`}
        // Una capa que crece desde el centro no tiene de dónde crecer
        // cuando ya ocupa el viewport entero: en el teléfono el gesto se
        // perdía y la ficha simplemente aparecía. Sube desde el borde de
        // abajo, que además es el único que el pulgar alcanza para
        // devolverla. Misma curva, mismo rol, otra dirección.
        variants={esHoja ? sheetUp : dialog}
        initial="hidden"
        animate="show"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
        className="mt-auto flex h-[92svh] w-full flex-col overflow-hidden rounded-t-[var(--r-card)] border-border shadow-[var(--shadow-lg)] lg:m-auto lg:h-[calc(100vh-48px)] lg:w-[min(var(--w-wide),calc(100vw-48px))] lg:rounded-[var(--r-card)] lg:border"
        style={{ backgroundColor: "var(--bg)" }}
      >
        {/* Cabecera */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 gap-3 sm:gap-3.5">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-bold sm:h-11 sm:w-11 sm:text-[14px]"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
            >
              {initials(o.company.name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                <h2 className="h1 text-[17px] sm:text-[21px]">{o.projectTitle}</h2>
                <StatusPill status={o.status} />
              </div>
              {/* La línea de ayuda del estado se fue: la píldora de al lado
                  del título ya dice en qué punto está la operación, y
                  repetirlo en prosa debajo era la misma información dos
                  veces, la segunda en el tamaño más chico de la pantalla. */}
              <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-2.5 text-[12.5px] text-mid">
                <span className="font-medium text-hi">{o.company.name}</span>
                <span>{o.company.city}</span>
                <Tag label={o.company.sector} />
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="focusable -mr-1 flex h-8 shrink-0 items-center rounded-[var(--r-input)] px-2 text-[12.5px] text-mid transition-colors hover:bg-surface-soft hover:text-hi"
          >
            Cerrar
          </button>
        </div>

        {/* Cuerpo — en mobile es una columna que scrollea entera, con la
            inversión primero (order-1); desde lg vuelve al panel lado a
            lado sin scroll de página. */}
        <div className="flex flex-1 flex-col overflow-y-auto lg:grid lg:min-h-0 lg:grid-cols-[1fr_320px] lg:overflow-hidden">
          {/* Inversión */}
          <div className="order-1 border-b border-border bg-surface p-4 sm:p-5 lg:order-2 lg:min-h-0 lg:overflow-y-auto lg:border-b-0">
            <InvestPanel
              o={o}
              onOpenFunds={onOpenFunds}
              onRequestAccess={onRequestAccess}
              onOpenPortfolio={onOpenPortfolio}
            />
          </div>

          {/* Pasos */}
          <div className="order-2 flex flex-col lg:order-1 lg:min-h-0 lg:border-r lg:border-border">
            <div
              role="tablist"
              aria-label="Secciones de la operación"
              className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface px-4 sm:px-6"
            >
              {STEPS.map((s) => {
                const on = step === s.key;
                return (
                  <button
                    key={s.key}
                    role="tab"
                    aria-selected={on}
                    onClick={() => go(s.key)}
                    className="focusable relative shrink-0 whitespace-nowrap px-3 py-3 text-[13px] transition-colors"
                    style={{
                      color: on ? "var(--brand-ink)" : "var(--text-mid)",
                      fontWeight: on ? 600 : 400,
                    }}
                  >
                    {s.label}
                    {on && (
                      <motion.span
                        layoutId="step-underline"
                        transition={T.indicator}
                        className="absolute inset-x-2 -bottom-px h-[2px] rounded-full"
                        style={{ backgroundColor: "var(--brand-ink)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="relative lg:min-h-0 lg:flex-1 lg:overflow-hidden">
              <AnimatePresence mode="wait" custom={dir}>
                <motion.div
                  key={step}
                  variants={slide(dir, 28)}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="px-4 py-4 sm:px-6 sm:py-5 lg:h-full lg:overflow-y-auto"
                >
                  {step === "resumen" && <Resumen o={o} />}
                  {step === "garantia" && <CollateralPanel o={o} />}
                  {step === "desembolsos" && <MilestoneTimeline o={o} />}
                  {step === "calificacion" && <ScorePanel o={o} />}
                  {step === "empresa" && <PassportPanel company={o.company} />}
                  {step === "orden" && <WaterfallPanel o={o} />}
                  {step === "mercado" && <OrderBook opportunitySlug={o.slug} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** El ticket con el que se explica todo. Es el más chico de los montos
 *  rápidos del panel de inversión, para que las dos columnas hablen de la
 *  misma plata. */
const TICKET_REFERENCIA = 1_000;

/**
 * El resumen antes eran cuatro cifras sueltas y dos cuadros de prosa:
 * "13.9% fija", "150,000 de meta", "25% de aporte", "3,859 de interés".
 * Todas ciertas y ninguna accionable. Un 13.9% no se puede juzgar sin
 * saber qué paga el resto del catálogo por el mismo riesgo; una meta de
 * recaudación es un dato del emisor, no del inversionista; y el "interés
 * total del crédito" ni siquiera era del crédito —salía de lo recaudado
 * hasta ese minuto, así que decía la quinta parte (ver `creditInterest`).
 *
 * Nada de eso respondía las tres preguntas con las que alguien decide:
 * cuánto gano en dinero, es caro o barato comparado con qué, y cuánto
 * pierdo si sale mal. Ahora la pantalla son esas tres, en ese orden, todo
 * expresado sobre el mismo ticket de referencia.
 */
function Resumen({ o }: { o: Opportunity }) {
  const { opportunities } = usePlatform();
  const track = issuerTrackRecord(o.company.passport);

  const ticket = usdc(TICKET_REFERENCIA);
  const interes = projectedReturn(o, ticket);
  const comparativa = compararConElCatalogo(o, opportunities);

  const cobertura = coverageBps(o);
  const recuperoBps = recoveryOnDefaultBps(o);
  const colchonBps = lossBufferBps(o);
  // Sobre el ticket, que es como se lee una pérdida: no "87%" sino
  // "vuelven 870 de los 1,000 que pusiste".
  const capitalEnRiesgo = ticket + interes;
  const recupero = (capitalEnRiesgo * BigInt(recuperoBps)) / 10000n;
  const perdida = capitalEnRiesgo - recupero;

  const dias = daysUntil(o.fundingDeadline);
  const hitos = o.milestones.length;

  return (
    <div className="flex flex-col gap-3.5">
      {/* 1 — El trato, en dinero. */}
      <section className="card p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="label">
            Si inviertes {TICKET_REFERENCIA.toLocaleString("es-PE")} USDC
          </h3>
          <span className="text-[11.5px] text-low">
            a {o.termMonths} meses
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="num text-[30px] font-semibold leading-none text-hi">
            {formatUsdc(ticket + interes)}
          </span>
          <span className="text-[12.5px] text-low">USDC al vencimiento</span>
          <span
            className="num ml-auto text-[15px] font-semibold"
            style={{ color: "var(--positive)" }}
          >
            +{formatUsdc(interes)}
          </span>
        </div>

        <p className="mt-1.5 text-[12px] text-low">
          Interés simple de {formatBps(o.apyBps)} anual, fijo. La empresa
          paga {formatUsdc(creditInterest(o))} USDC por el crédito completo.
        </p>

        {comparativa && (
          <Comparacion
            titulo="Rentabilidad"
            esta={formatBps(o.apyBps)}
            estaBps={o.apyBps}
            medianaBps={comparativa.apyMedianaBps}
            mediana={formatBps(comparativa.apyMedianaBps)}
            delta={`${comparativa.apyDeltaBps >= 0 ? "+" : "−"}${Math.abs(comparativa.apyDeltaBps / 100).toFixed(1)} pp`}
            mejor={comparativa.apyDeltaBps >= 0}
            pie={leyenda(comparativa)}
          />
        )}
      </section>

      {/* 2 — El escenario malo, que era el que no estaba. */}
      <section className="card p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="label">Si la empresa no paga</h3>
          <span className="num text-[11.5px] text-low">
            cobertura {formatRatio(cobertura)}
          </span>
        </div>

        {/* Con la garantía alcanzando, la cifra que informa NO es "recuperas
            todo" —eso repite el número de arriba y hace parecer gratis un
            default—: es cuánto puede caer el activo antes de que empieces a
            perder. Cuando no alcanza, ahí sí lo que importa es la pérdida. */}
        {colchonBps > 0 ? (
          <>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="num text-[30px] font-semibold leading-none text-hi">
                −{formatBps(colchonBps, 0)}
              </span>
              <span className="max-w-[30ch] text-[12.5px] leading-snug text-low">
                puede caer el valor del activo antes de que pierdas capital
              </span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-low">
              Vendiéndolo por encima de eso, la ejecución te devuelve los{" "}
              {formatUsdc(capitalEnRiesgo)} completos —capital e interés— ya
              descontados costos legales y servicing.
            </p>
          </>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span
                className="num text-[30px] font-semibold leading-none"
                style={{ color: "var(--warning)" }}
              >
                {formatUsdc(recupero)}
              </span>
              <span className="text-[12.5px] text-low">
                de los {formatUsdc(capitalEnRiesgo)} que esperabas
              </span>
              <span
                className="num ml-auto text-[15px] font-semibold"
                style={{ color: "var(--negative)" }}
              >
                −{formatUsdc(perdida)}
              </span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-low">
              La garantía no alcanza a cubrir capital más interés ni
              vendiéndose a su valor neto estimado: recuperas{" "}
              {formatBps(recuperoBps, 0)}.
            </p>
          </>
        )}

        <p className="mt-1.5 text-[12px] leading-relaxed text-low">
          Respaldo neto de {formatUsdc(o.collateral.netRecoverableValue)} USDC.
          La empresa puso {formatBps(o.borrowerContributionBps, 0)} del
          proyecto: ese capital se pierde antes que el tuyo.
        </p>

        {comparativa && (
          <Comparacion
            titulo="Cobertura"
            esta={formatRatio(cobertura)}
            estaBps={cobertura}
            medianaBps={comparativa.coberturaMedianaBps}
            mediana={formatRatio(comparativa.coberturaMedianaBps)}
            delta={`${comparativa.coberturaDeltaBps >= 0 ? "+" : "−"}${Math.abs(comparativa.coberturaDeltaBps / 10000).toFixed(2)}x`}
            mejor={comparativa.coberturaDeltaBps >= 0}
            pie={leyenda(comparativa)}
          />
        )}
      </section>

      {/* 3 — Cuándo se mueve la plata. Estaba repartido entre tres
          pestañas y ninguna lo decía en una línea. */}
      <section className="card p-4 sm:p-5">
        <h3 className="label">Cuándo se mueve el dinero</h3>
        <div className="mt-2.5 flex flex-col">
          <Row
            label="Cierra el fondeo"
            value={dias > 0 ? `en ${dias} días` : "cerrado"}
          />
          <Row
            label="Sale al proyecto"
            value={`por ${hitos} hito${hitos === 1 ? "" : "s"} verificado${hitos === 1 ? "" : "s"}`}
          />
          <Row label="Te devuelven" value={`mes ${o.termMonths}`} />
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-low">
          Hasta que un hito se aprueba, el capital sigue en el contrato — no
          en la caja de la empresa.
        </p>
      </section>

      {/* 4 — Quién pide y para qué. Va último a propósito: es el contexto
          de la decisión, no la decisión. */}
      <section className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="label">Quién pide</h3>
          <span
            className="text-[12px] font-medium"
            style={{ color: TRACK_TONE_COLOR[track.tone] }}
          >
            {track.label}
            {!track.firstTime && (
              <span className="num ml-1.5 text-[11.5px] text-low">
                {o.company.passport.onTimeRepayments}/
                {o.company.passport.onTimeRepayments +
                  o.company.passport.lateRepayments +
                  o.company.passport.defaults}{" "}
                a tiempo
              </span>
            )}
          </span>
        </div>

        <p className="mt-2 text-[13px] leading-relaxed text-mid">{o.summary}</p>

        {o.highlights.length > 0 && (
          // El check verde afirmaba "verificado" sobre cada frase, que es
          // más de lo que el dato sostiene: son hechos declarados en el
          // expediente. La lista los enumera sin certificarlos.
          <ul className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
            {o.highlights.map((h) => (
              <li
                key={h}
                className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-mid"
              >
                <span className="marker mt-[7px]" />
                {h}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function leyenda(c: Comparativa): string {
  return c.base === "grado"
    ? `Mediana de las ${c.muestra} operaciones ${c.grado} del catálogo`
    : `Mediana de las ${c.muestra} operaciones del catálogo — el grado ${c.grado} todavía tiene pocas`;
}

/**
 * Dos barras a la misma escala: esta operación y la mediana de sus
 * comparables. La barra existe porque "13.9% contra 12.5%" en texto obliga
 * a restar mentalmente; puestas una debajo de otra, la diferencia se ve
 * antes de leerla.
 */
function Comparacion({
  titulo,
  esta,
  estaBps,
  mediana,
  medianaBps,
  delta,
  mejor,
  pie,
}: {
  titulo: string;
  esta: string;
  estaBps: number;
  mediana: string;
  medianaBps: number;
  delta: string;
  mejor: boolean;
  pie: string;
}) {
  const tope = Math.max(estaBps, medianaBps) || 1;
  const color = mejor ? "var(--positive)" : "var(--warning)";

  return (
    <div className="mt-3.5 border-t border-border pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11.5px] text-low">{titulo} vs. comparables</span>
        <span className="num text-[12px] font-semibold" style={{ color }}>
          {delta}
        </span>
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        <Barra
          etiqueta="Esta operación"
          valor={esta}
          fraccion={estaBps / tope}
          color={color}
        />
        <Barra
          etiqueta="Mediana"
          valor={mediana}
          fraccion={medianaBps / tope}
          color="var(--border-strong)"
        />
      </div>

      <p className="mt-2 text-[11px] text-low">{pie}</p>
    </div>
  );
}

function Barra({
  etiqueta,
  valor,
  fraccion,
  color,
}: {
  etiqueta: string;
  valor: string;
  fraccion: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[92px] shrink-0 text-[11.5px] text-mid">{etiqueta}</span>
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-soft">
        <motion.span
          initial={{ scaleX: 0 }}
          animate={{ scaleX: Math.max(0.02, Math.min(1, fraccion)) }}
          transition={T.base}
          className="block h-full origin-left rounded-full"
          style={{ backgroundColor: color }}
        />
      </span>
      <span className="num w-[52px] shrink-0 text-right text-[12px] font-medium text-hi">
        {valor}
      </span>
    </div>
  );
}
