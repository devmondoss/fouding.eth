"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { OpportunityCard } from "@/components/domain/OpportunityCard";
import { usePlatform } from "@/lib/data/store";
import { formatUsdc } from "@/lib/format";
import type { Opportunity, OpportunityStatus } from "@/lib/types";

const PER_PAGE = 3;

const FILTROS: { key: OpportunityStatus | "all"; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "funding", label: "En recaudación" },
  { key: "active", label: "En ejecución" },
  { key: "repaid", label: "Pagadas" },
  { key: "defaulted", label: "Incumplidas" },
];

/**
 * Catálogo. Desde lg (desktop) es paginado y sin scroll: se avanza por
 * páginas, con teclado o con las flechas — la pantalla de trabajo
 * calibrada en design-system.md §6. Debajo de lg, la página del navegador
 * ya hace scroll normal (ver globals.css), así que en mobile el catálogo
 * es una lista vertical simple: todo lo visible, sin paginar.
 */
export function Deck({ onSelect }: { onSelect: (o: Opportunity) => void }) {
  const { opportunities } = usePlatform();
  const [filtro, setFiltro] = useState<OpportunityStatus | "all">("all");
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);

  const visibles = useMemo(
    () =>
      opportunities.filter((o) => filtro === "all" || o.status === filtro),
    [opportunities, filtro],
  );

  const pages = Math.max(1, Math.ceil(visibles.length / PER_PAGE));
  const current = Math.min(page, pages - 1);
  const slice = visibles.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  const go = (n: number) => {
    if (n < 0 || n >= pages) return;
    setDir(n > current ? 1 : -1);
    setPage(n);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(current + 1);
      if (e.key === "ArrowLeft") go(current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const total = opportunities.reduce((s, o) => s + o.raisedAmount, 0n);
  const abiertas = opportunities.filter((o) => o.status === "funding").length;

  const filtros = (
    <div className="flex gap-2 overflow-x-auto px-4 pb-1 sm:px-6 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
      {FILTROS.map((f) => {
        const on = filtro === f.key;
        return (
          <button
            key={f.key}
            onClick={() => {
              setFiltro(f.key);
              setPage(0);
            }}
            className="shrink-0 rounded-[var(--r-pill)] border px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap transition-colors"
            style={{
              color: on ? "var(--brand-ink)" : "var(--text-mid)",
              backgroundColor: on ? "var(--brand)" : "var(--surface)",
              borderColor: on ? "var(--brand)" : "var(--border)",
            }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col lg:h-full lg:px-8 lg:py-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 px-4 pt-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:gap-0 lg:px-0 lg:pt-0">
        <div>
          <h1 className="h1 text-[22px] sm:text-[26px]">Oportunidades</h1>
          <p className="mt-1 text-[13px] text-mid">
            <span className="num">{abiertas}</span> rondas abiertas ·{" "}
            <span className="num">{formatUsdc(total)}</span> USDC colocados
          </p>
        </div>

        <div className="hidden lg:block">{filtros}</div>
      </div>

      <div className="-mx-4 mt-3 overflow-hidden lg:hidden">{filtros}</div>

      {/* Mobile / tablet: lista vertical, sin paginar — la página ya scrollea */}
      <div className="mt-4 grid grid-cols-1 gap-4 px-4 pb-8 sm:grid-cols-2 sm:px-6 lg:hidden">
        {visibles.map((o, i) => (
          <OpportunityCard
            key={o.id}
            o={o}
            index={i}
            onSelect={() => onSelect(o)}
          />
        ))}
      </div>

      {/* Desktop: carrusel paginado, cero scroll de página */}
      <div className="relative mt-5 hidden min-h-0 flex-1 lg:block">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={`${filtro}-${current}`}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.3, ease: [0.22, 0.9, 0.3, 1] }}
            className="grid h-full grid-cols-3 gap-5"
          >
            {slice.map((o, i) => (
              <OpportunityCard
                key={o.id}
                o={o}
                index={i}
                onSelect={() => onSelect(o)}
              />
            ))}
            {/* Rellena la grilla para que las tarjetas no se estiren */}
            {Array.from({ length: PER_PAGE - slice.length }).map((_, i) => (
              <div key={`ghost-${i}`} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Paginación — solo desktop */}
      <div className="mt-5 hidden shrink-0 items-center justify-center gap-5 lg:flex">
        <PagerButton
          onClick={() => go(current - 1)}
          disabled={current === 0}
          side="left"
        />

        <div className="flex items-center gap-2">
          {Array.from({ length: pages }).map((_, n) => (
            <button
              key={n}
              onClick={() => go(n)}
              aria-label={`Página ${n + 1}`}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: n === current ? 26 : 6,
                backgroundColor:
                  n === current ? "var(--brand)" : "var(--border-strong)",
              }}
            />
          ))}
        </div>

        <PagerButton
          onClick={() => go(current + 1)}
          disabled={current >= pages - 1}
          side="right"
        />
      </div>
    </div>
  );
}

function PagerButton({
  onClick,
  disabled,
  side,
}: {
  onClick: () => void;
  disabled: boolean;
  side: "left" | "right";
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface transition-all disabled:opacity-30 enabled:hover:border-border-strong enabled:hover:shadow-[var(--shadow-md)]"
    >
      <Icon className="h-4 w-4 text-mid" />
    </button>
  );
}
