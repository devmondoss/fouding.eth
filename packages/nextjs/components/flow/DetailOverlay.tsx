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
import { Metric } from "@/components/ui/Stat";
import { formatBps, formatUsdc } from "@/lib/format";
import { useFocusTrap, useLayerKeys } from "@/lib/keyboard";
import { dialog, scrim, sheetUp, slide, T } from "@/lib/motion";
import { useEsHoja } from "@/lib/useViewport";
import { expectedInterest, issuerTrackRecord } from "@/lib/opportunity";
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

function Resumen({ o }: { o: Opportunity }) {
  const track = issuerTrackRecord(o.company.passport);
  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-center justify-between gap-3 rounded-[var(--r-panel)] border px-4 py-3"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: TRACK_TONE_COLOR[track.tone],
        }}
      >
        <span
          className="text-[12.5px] font-medium"
          style={{ color: TRACK_TONE_COLOR[track.tone] }}
        >
          {track.label}
        </span>
        {!track.firstTime && (
          <span className="num text-[11.5px] text-low">
            {o.company.passport.onTimeRepayments}/
            {o.company.passport.onTimeRepayments +
              o.company.passport.lateRepayments +
              o.company.passport.defaults}{" "}
            pagos a tiempo
          </span>
        )}
      </div>

      <section className="card p-5">
        <h3 className="h3">Destino del financiamiento</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-mid">
          {o.summary}
        </p>
      </section>

      {o.highlights.length > 0 && (
        <section className="card p-5">
          <h3 className="h3">Aspectos destacados</h3>
          <ul className="mt-3 flex flex-col gap-2.5">
            {o.highlights.map((h) => (
              // El check verde afirmaba "verificado" sobre cada frase, que
              // es más de lo que el dato sostiene: son hechos declarados en
              // el expediente. El cuadro los enumera sin certificarlos.
              <li
                key={h}
                className="flex items-start gap-2.5 text-[13px] leading-relaxed text-mid"
              >
                <span className="marker mt-[7px]" />
                {h}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="card px-4 py-3.5 sm:px-5 sm:py-4">
          <Metric
            label="Rentabilidad"
            value={formatBps(o.apyBps)}
            unit={`fija, a ${o.termMonths} meses`}
            accent="var(--brand-ink)"
          />
        </div>
        <div className="card px-4 py-3.5 sm:px-5 sm:py-4">
          <Metric
            label="Meta de recaudación"
            value={formatUsdc(o.targetAmount)}
            unit="USDC"
          />
        </div>
        <div className="card px-4 py-3.5 sm:px-5 sm:py-4">
          <Metric
            label="Aporte de la empresa"
            value={formatBps(o.borrowerContributionBps, 0)}
            unit="del costo del proyecto"
          />
        </div>
        <div className="card px-4 py-3.5 sm:px-5 sm:py-4">
          <Metric
            label="Interés total del crédito"
            value={formatUsdc(expectedInterest(o))}
            unit="que pagará la empresa"
          />
        </div>
      </div>
    </div>
  );
}
