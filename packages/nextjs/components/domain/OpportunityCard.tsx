"use client";

import { motion } from "motion/react";
import { CoverArt } from "./CoverArt";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusPill } from "@/components/ui/Pill";
import { ScoreBadge } from "./ScoreBadge";
import { coverageBps, fundingBps } from "@/lib/opportunity";
import { daysUntil, formatBps, formatRatio } from "@/lib/format";
import { computeScore } from "@/lib/underwriting";
import { T } from "@/lib/motion";
import type { Opportunity } from "@/lib/types";

/**
 * v2 — editorial, no "tarjeta de ecommerce". El titular tipográfico es
 * el protagonista, no una foto de portada; la rentabilidad se lee como
 * un titular de revista financiera, no como una métrica de dashboard.
 * La portada (CoverArt) baja a acento de esquina, watermark, no banner.
 */
export function OpportunityCard({
  o,
  onSelect,
  index = 0,
}: {
  o: Opportunity;
  onSelect: () => void;
  index?: number;
}) {
  const score = computeScore(o);
  const funding = fundingBps(o);
  const cov = coverageBps(o);
  const days = daysUntil(o.fundingDeadline);
  const open = o.status === "funding";

  return (
    <motion.button
      layout
      onClick={onSelect}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, transition: T.fast }}
      transition={{ ...T.base, delay: index * 0.06 }}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.99 }}
      className="focusable card card-hover group relative flex h-full w-full flex-col overflow-hidden p-5 text-left"
    >
      {/* Watermark de portada — esquina, no banner. La marca es el patrón
          de la garantía, apenas visible detrás del titular. */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 overflow-hidden rounded-full opacity-70">
        <CoverArt sector={o.company.sector} collateralKind={o.collateral.kind} height={112} />
      </div>

      <div className="relative flex items-center justify-between gap-2">
        <div className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-low">
          {o.company.sector} · {o.company.city}
        </div>
        <StatusPill status={o.status} />
      </div>

      {/* Titular — el elemento con más peso visual de la card. */}
      <h3 className="relative mt-2 line-clamp-2 text-[21px] font-bold leading-[1.15] tracking-[-0.015em] text-hi">
        {o.projectTitle}
      </h3>
      <div className="relative mt-1 truncate text-[12px] text-mid">
        {o.company.name}
      </div>

      {/* Titular numérico — rentabilidad como cifra de portada, no
          como celda de métrica. */}
      <div className="relative mt-4 flex items-baseline gap-3">
        <span className="num text-[40px] font-bold leading-none tracking-[-0.02em] text-hi">
          {formatBps(o.apyBps)}
        </span>
        <div className="pb-0.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-low">
            Rentabilidad
          </div>
          <div className="num text-[12.5px] font-medium text-mid">
            a {o.termMonths} meses
          </div>
        </div>
      </div>

      {/* El estado de la cobertura lo lleva la frase, no un escudo: dos
          escudos distintos del mismo tamaño se diferenciaban por el color
          antes que por la forma, así que en la práctica el dato era
          cromático. "insuficiente" no depende de nada. */}
      <div
        className="relative mt-1.5 text-[11px] font-medium"
        style={{ color: cov >= 10000 ? "var(--positive)" : "var(--negative)" }}
      >
        <span className="num">{formatRatio(cov)}</span> de cobertura
        {cov >= 10000 ? " de garantía" : " — insuficiente"}
      </div>

      <div className="relative mt-4 flex-1" />

      <div className="relative border-t border-border pt-3.5">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-low">
          <span>{formatBps(funding, 0)} recaudado</span>
          <span className="num">{o.investorCount} inversionistas</span>
        </div>
        <ProgressBar
          bps={funding}
          height={3}
          color={open ? "var(--brand-strong)" : "var(--positive)"}
        />

        <div className="mt-3 flex items-center justify-between">
          <ScoreBadge score={score.score} grade={score.grade} size="sm" />
          {open && days > 0 && (
            <span className="text-[11px] text-low">
              <span className="num">{days}</span> días para cerrar
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

export function initials(name: string) {
  return name
    .replace(/S\.A\.C\.|E\.I\.R\.L\.|S\.A\.|S\.R\.L\./g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
