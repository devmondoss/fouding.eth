"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, MapPin, X } from "lucide-react";
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
import {
  expectedInterest,
  issuerTrackRecord,
  STATUS_HELP,
} from "@/lib/opportunity";
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
}: {
  o: Opportunity;
  onClose: () => void;
  onOpenFunds: () => void;
}) {
  const [step, setStep] = useState<StepKey>("resumen");
  const [dir, setDir] = useState(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      const i = STEPS.findIndex((s) => s.key === step);
      if (e.key === "ArrowRight" && i < STEPS.length - 1) go(STEPS[i + 1].key);
      if (e.key === "ArrowLeft" && i > 0) go(STEPS[i - 1].key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function go(next: StepKey) {
    const from = STEPS.findIndex((s) => s.key === step);
    const to = STEPS.findIndex((s) => s.key === next);
    setDir(to > from ? 1 : -1);
    setStep(next);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-50 flex flex-col lg:p-6"
      style={{ backgroundColor: "rgba(16,24,40,0.35)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.28, ease: [0.22, 0.9, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="m-auto flex h-full w-full flex-col overflow-hidden border-border shadow-[var(--shadow-lg)] lg:h-[calc(100vh-48px)] lg:w-[min(1240px,calc(100vw-48px))] lg:rounded-[var(--r-card)] lg:border"
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
              <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-2.5 text-[12.5px] text-mid">
                <span className="font-medium text-hi">{o.company.name}</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {o.company.city}
                </span>
                <Tag label={o.company.sector} />
              </div>
              <p className="mt-1 text-[11.5px] text-low">
                {STATUS_HELP[o.status]}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border transition-colors hover:bg-surface-soft"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4 text-mid" />
          </button>
        </div>

        {/* Cuerpo — en mobile es una columna que scrollea entera, con la
            inversión primero (order-1); desde lg vuelve al panel lado a
            lado sin scroll de página. */}
        <div className="flex flex-1 flex-col overflow-y-auto lg:grid lg:min-h-0 lg:grid-cols-[1fr_320px] lg:overflow-hidden">
          {/* Inversión */}
          <div className="order-1 border-b border-border bg-surface p-4 sm:p-5 lg:order-2 lg:min-h-0 lg:overflow-y-auto lg:border-b-0">
            <InvestPanel o={o} onOpenFunds={onOpenFunds} />
          </div>

          {/* Pasos */}
          <div className="order-2 flex flex-col lg:order-1 lg:min-h-0 lg:border-r lg:border-border">
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface px-4 sm:px-6">
              {STEPS.map((s) => {
                const on = step === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => go(s.key)}
                    className="relative shrink-0 whitespace-nowrap px-3 py-3 text-[13px] transition-colors"
                    style={{
                      color: on ? "var(--brand-ink)" : "var(--text-mid)",
                      fontWeight: on ? 600 : 400,
                    }}
                  >
                    {s.label}
                    {on && (
                      <motion.span
                        layoutId="step-underline"
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
                  initial={{ opacity: 0, x: dir * 28 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: dir * -28 }}
                  transition={{ duration: 0.26, ease: [0.22, 0.9, 0.3, 1] }}
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
              <li
                key={h}
                className="flex items-start gap-2.5 text-[13px] leading-relaxed text-mid"
              >
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: "var(--positive)" }}
                />
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
