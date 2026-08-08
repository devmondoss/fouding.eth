"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { OpportunityCard } from "@/components/domain/OpportunityCard";
import { usePlatform } from "@/lib/data/store";
import { formatUsdc } from "@/lib/format";
import { useBaseKeys } from "@/lib/keyboard";
import { slide } from "@/lib/motion";
import { STATUS_LABEL } from "@/lib/opportunity";
import type { Opportunity, OpportunityStatus } from "@/lib/types";

const PER_PAGE = 3;

/** Un solo estado, un solo nombre. Los rótulos salen de STATUS_LABEL para
 *  que el filtro, la píldora de la tarjeta y la dona del portafolio no
 *  puedan volver a llamarle distinto a lo mismo — ver design-system.md §8. */
const FILTROS: { key: OpportunityStatus | "all"; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "funding", label: STATUS_LABEL.funding },
  { key: "active", label: STATUS_LABEL.active },
  { key: "repaid", label: STATUS_LABEL.repaid },
  { key: "defaulted", label: STATUS_LABEL.defaulted },
];

/**
 * Catálogo. Desde lg (desktop) es paginado y sin scroll: se avanza por
 * páginas, con teclado o con las flechas — la pantalla de trabajo
 * calibrada en docs/design-system.md §6. Debajo de lg, la página del navegador
 * ya hace scroll normal (ver globals.css), así que en mobile el catálogo
 * es una lista vertical simple: todo lo visible, sin paginar.
 */
export function Deck({ onSelect }: { onSelect: (o: Opportunity) => void }) {
  const { opportunities, usingSeedData } = usePlatform();
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

  // Solo cuando no hay ficha ni panel abierto encima, y nunca dentro de un
  // campo: escribir un monto no debe paginar el catálogo de atrás.
  useBaseKeys({
    onPrev: () => go(current - 1),
    onNext: () => go(current + 1),
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
            aria-pressed={on}
            className="focusable shrink-0 rounded-[var(--r-pill)] border px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap transition-colors"
            style={{
              color: on ? "var(--brand-ink)" : "var(--text-mid)",
              backgroundColor: on ? "var(--brand)" : "var(--surface)",
              // El relleno chartreuse mide 1.13:1 contra el blanco de la
              // página: sin un borde de tinta, el chip seleccionado no tiene
              // silueta. El borde la da sin romper la regla de §4.
              borderColor: on ? "var(--brand-ink)" : "var(--border)",
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

      {/* Si el catálogo no vino de la base, se dice. Mostrar datos
          sembrados como si fueran reales es exactamente lo que el pitch
          promete no hacer. */}
      {usingSeedData && (
        <div
          className="mx-4 mt-3 rounded-[var(--r-panel)] border px-3 py-2 text-[12px] sm:mx-6 lg:mx-0"
          style={{ borderColor: "var(--warning)", color: "var(--warning)" }}
        >
          Catálogo de demostración — ningún verificador publicó todavía.
        </div>
      )}

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
            variants={slide(dir)}
            initial="hidden"
            animate="show"
            exit="exit"
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
              aria-label={`Página ${n + 1} de ${pages}`}
              aria-current={n === current ? "true" : undefined}
              className="focusable h-1.5 rounded-full transition-all duration-300"
              style={{
                width: n === current ? 26 : 6,
                // Chartreuse sobre --border-strong mide 1.30:1 y es *más
                // claro* que los puntos inactivos: el activo se leía como el
                // apagado. La tinta lo invierte.
                backgroundColor:
                  n === current ? "var(--brand-ink)" : "var(--border-strong)",
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

/**
 * Paginación con palabras. Eran dos chevrones en círculos de 36px: el
 * glifo direccional es el que menos falta hace, porque la fila ya está
 * ordenada de izquierda a derecha y los puntos del medio dicen dónde
 * estás. Con la palabra, además, se sabe qué avanza — la página, no la
 * tarjeta ni el paso de la ficha.
 */
function PagerButton({
  onClick,
  disabled,
  side,
}: {
  onClick: () => void;
  disabled: boolean;
  side: "left" | "right";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Página anterior" : "Página siguiente"}
      className="focusable flex h-9 items-center rounded-[var(--r-input)] px-2.5 text-[12.5px] font-medium text-mid transition-colors disabled:opacity-30 enabled:hover:bg-surface-soft enabled:hover:text-hi"
    >
      {side === "left" ? "Anterior" : "Siguiente"}
    </button>
  );
}
