"use client";

import { motion } from "motion/react";
import { Clock, Sparkles } from "lucide-react";
import { CoverArt } from "./CoverArt";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusPill } from "@/components/ui/Pill";
import { ScoreBadge } from "./ScoreBadge";
import { coverageBps, fundingBps } from "@/lib/opportunity";
import { daysUntil, formatBps, formatRatio, formatUsdc } from "@/lib/format";
import { computeScore } from "@/lib/underwriting";
import { T } from "@/lib/motion";
import type { Opportunity } from "@/lib/types";

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
  const cov = coverageBps(o);
  const funding = fundingBps(o);
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
      className="card card-hover group flex h-full w-full flex-col overflow-hidden text-left"
    >
      {/* Portada: lo primero que se ve, no un número */}
      <div className="relative">
        <div className="overflow-hidden">
          <motion.div
            transition={{ duration: 0.4, ease: [0.22, 0.9, 0.3, 1] }}
            className="group-hover:scale-[1.04]"
            style={{ transition: "transform 0.4s cubic-bezier(0.22,0.9,0.3,1)" }}
          >
            <CoverArt sector={o.company.sector} collateralKind={o.collateral.kind} />
          </motion.div>
        </div>

        <div className="absolute right-3 top-3">
          <StatusPill status={o.status} />
        </div>

        {/* Avatar de la empresa, montado sobre el borde de la portada */}
        <div className="absolute -bottom-4 left-4">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-[8px] border-2 border-surface text-[12px] font-bold shadow-[var(--shadow-sm)]"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
          >
            {initials(o.company.name)}
          </span>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="flex flex-1 flex-col p-4 pt-6">
        <div className="text-[11.5px] text-mid">
          {o.company.name} · {o.company.city}
        </div>
        <h3 className="h3 mt-0.5 line-clamp-2 leading-snug">{o.projectTitle}</h3>

        {/* Un hecho del proyecto, no una cifra: es lo que da contexto */}
        {o.highlights[0] && (
          <div className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug text-mid">
            <Sparkles
              className="mt-0.5 h-3 w-3 shrink-0"
              style={{ color: "var(--brand-ink)" }}
            />
            <span className="line-clamp-2">{o.highlights[0]}</span>
          </div>
        )}

        <div className="mt-3.5 flex items-end justify-between">
          <div>
            <div className="label">Rentabilidad</div>
            <div
              className="num text-[26px] font-bold leading-none"
              style={{ color: "var(--brand-ink)" }}
            >
              {formatBps(o.apyBps)}
            </div>
          </div>
          <div className="text-right">
            <div className="label">Plazo</div>
            <div className="num text-[15px] font-semibold text-hi">
              {o.termMonths} meses
            </div>
          </div>
        </div>

        <div className="flex-1" />

        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
            <span className="num font-semibold text-hi">
              {formatUsdc(o.raisedAmount)}
              <span className="ml-1 font-sans font-normal text-low">
                de {formatUsdc(o.targetAmount)}
              </span>
            </span>
            <span className="num text-mid">{formatBps(funding, 0)}</span>
          </div>
          <ProgressBar
            bps={funding}
            color={open ? "var(--brand)" : "var(--positive)"}
          />
          <div className="mt-2 flex items-center justify-between text-[11.5px] text-low">
            <span>{o.investorCount} inversionistas</span>
            {open && days > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {days} días
              </span>
            )}
          </div>
        </div>

        <div className="mt-3.5 flex items-center justify-between border-t border-border pt-3">
          <ScoreBadge score={score.score} grade={score.grade} size="sm" />
          <span
            className="flex items-center gap-1.5 text-[12px]"
            style={{
              color: cov >= 10000 ? "var(--positive)" : "var(--negative)",
            }}
          >
            <span className="num font-semibold">{formatRatio(cov)}</span>
            <span className="text-low">cobertura</span>
          </span>
        </div>
      </div>
    </motion.button>
  );
}
