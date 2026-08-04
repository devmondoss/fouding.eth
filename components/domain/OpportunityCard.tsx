"use client";

import { motion } from "motion/react";
import { Clock, ShieldCheck } from "lucide-react";
import { CoverArt } from "./CoverArt";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusPill } from "@/components/ui/Pill";
import { ScoreBadge } from "./ScoreBadge";
import { coverageBps, fundingBps } from "@/lib/opportunity";
import { daysUntil, formatBps, formatRatio } from "@/lib/format";
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

      {/* Cuerpo — solo lo que se necesita para decidir de un vistazo.
          El resto (hitos, garantía, cobertura, inversionistas) vive en
          la ficha completa, no en la tarjeta. */}
      <div className="flex flex-1 flex-col p-4 pt-6">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-[11.5px] text-mid">
            {o.company.name} · {o.company.city}
          </div>
          <span
            className="flex shrink-0 items-center gap-1 text-[11px] font-medium"
            style={{ color: cov >= 10000 ? "var(--positive)" : "var(--negative)" }}
          >
            <ShieldCheck className="h-3 w-3" />
            <span className="num">{formatRatio(cov)}</span> garantía
          </span>
        </div>
        <h3 className="h3 mt-0.5 line-clamp-2 leading-snug">{o.projectTitle}</h3>

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
          <div className="mb-1.5 flex items-center justify-between text-[11.5px] text-low">
            <span>Recaudado</span>
            <span className="num text-mid">{formatBps(funding, 0)}</span>
          </div>
          <ProgressBar
            bps={funding}
            color={open ? "var(--brand)" : "var(--positive)"}
          />
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-low">
            <span>{o.investorCount} inversionistas</span>
            {open && days > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {days} días
              </span>
            )}
          </div>
        </div>

        <div className="mt-3.5 border-t border-border pt-3">
          <ScoreBadge score={score.score} grade={score.grade} size="sm" />
        </div>
      </div>
    </motion.button>
  );
}
