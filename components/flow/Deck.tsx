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
 * Catálogo paginado. No hay scroll: se avanza por páginas, con teclado o
 * con las flechas.
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

  return (
    <div className="flex h-full flex-col px-8 py-6">
      {/* Encabezado */}
      <div className="flex shrink-0 items-end justify-between">
        <div>
          <h1 className="h1 text-[26px]">Oportunidades</h1>
          <p className="mt-1 text-[13px] text-mid">
            <span className="num">{abiertas}</span> rondas abiertas ·{" "}
            <span className="num">{formatUsdc(total)}</span> USDC colocados
          </p>
        </div>

        <div className="flex gap-2">
          {FILTROS.map((f) => {
            const on = filtro === f.key;
            return (
              <button
                key={f.key}
                onClick={() => {
                  setFiltro(f.key);
                  setPage(0);
                }}
                className="rounded-[var(--r-pill)] border px-3 py-1.5 text-[12.5px] font-medium transition-colors"
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
      </div>

      {/* Carrusel */}
      <div className="relative mt-5 min-h-0 flex-1">
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

      {/* Paginación */}
      <div className="mt-5 flex shrink-0 items-center justify-center gap-5">
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
