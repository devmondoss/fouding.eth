"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  FileCheck2,
  Landmark,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useLayerKeys } from "@/lib/keyboard";
import { scrim, slide } from "@/lib/motion";

/**
 * Explicación del producto en pasos. Se muestra UNA sola vez por navegador
 * (ver useOnce). Después no vuelve a aparecer: quien ya entendió cómo
 * funciona no debería volver a leerlo.
 */

/** El nombre de la etapa vive en el riel de pasos, no como antetítulo
 *  encima del titular: ahí solo repetía en pequeño lo que los puntos ya
 *  decían, y dejaba la navegación como cuatro puntos sin nombre. */
const SLIDES = [
  {
    icon: Building2,
    stage: "El origen",
    title: "Empresas que ya facturan",
    body: "PyMEs peruanas con al menos dos años operando y ventas comprobables piden capital para un proyecto concreto: una máquina, una flota, una planta. No para caja general.",
  },
  {
    icon: FileCheck2,
    stage: "El filtro",
    title: "Se verifica antes de publicar",
    body: "Revisamos ventas, titularidad del activo y gravámenes previos. Al valor del activo se le aplica un castigo y solo publicamos si lo que quedaría al liquidarlo cubre el préstamo.",
  },
  {
    icon: Landmark,
    stage: "El desembolso",
    title: "Capital bajo custodia contractual",
    body: "El capital queda en un contrato en Arbitrum y se libera por tramos únicamente cuando la empresa demuestra el cumplimiento verificado de cada hito del proyecto.",
  },
  {
    icon: Wallet,
    stage: "El retorno",
    title: "Prelación de pagos definida desde el inicio",
    body: "El inversionista recibe capital e interés según el cronograma pactado. Ante un incumplimiento, se ejecuta la garantía y el monto recuperado se distribuye según un orden de prelación contractual. El recupero puede ser parcial.",
  },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const last = i === SLIDES.length - 1;

  const go = (next: number) => {
    setDir(next > i ? 1 : -1);
    setI(next);
  };

  const current = SLIDES[i];
  const Icon = current.icon;

  // Cuatro pasos con ←/→, sin tocar el catálogo que quedó detrás.
  useLayerKeys({
    onPrev: () => i > 0 && go(i - 1),
    onNext: () => i < SLIDES.length - 1 && go(i + 1),
  });

  return (
    <motion.div
      variants={scrim}
      initial="hidden"
      animate="show"
      exit="exit"
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ backgroundColor: "var(--surface)" }}
    >
      {/* Barra superior */}
      <div className="flex h-14 shrink-0 items-center justify-between px-5 sm:h-[60px] sm:px-8">
        <span className="text-[15px] font-bold tracking-[-0.02em] text-hi">
          Founding
        </span>
        <button
          onClick={onDone}
          className="focusable text-[13px] text-low transition-colors hover:text-hi"
        >
          Saltar
        </button>
      </div>

      {/* Contenido */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-5 sm:px-8">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={i}
            custom={dir}
            variants={slide(dir, 48)}
            initial="hidden"
            animate="show"
            exit="exit"
            className="w-full max-w-[640px] text-center"
          >
            <motion.span
              layout
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-[14px]"
              style={{ backgroundColor: "var(--brand-soft)" }}
            >
              <Icon className="h-6 w-6" style={{ color: "var(--brand-ink)" }} />
            </motion.span>

            <h2 className="h1 mt-6 text-[24px] sm:text-[34px]">
              {current.title}
            </h2>

            <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-relaxed text-mid">
              {current.body}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controles */}
      <div className="flex h-20 shrink-0 items-center justify-between px-5 sm:h-[92px] sm:px-8">
        <Button
          variant="ghost"
          onClick={() => go(i - 1)}
          disabled={i === 0}
          icon={<ArrowLeft className="h-4 w-4" />}
        >
          Atrás
        </Button>

        {/* Riel de etapas: cada paso dice su nombre en vez de ser un punto.
            El activo va en tinta — chartreuse sobre neutro medía 1.30:1 y
            quedaba más claro que los inactivos. */}
        <div className="hidden items-end gap-5 sm:flex">
          {SLIDES.map((s, n) => {
            const on = n === i;
            const seen = n <= i;
            return (
              <button
                key={s.stage}
                onClick={() => go(n)}
                aria-current={on ? "step" : undefined}
                className="focusable group flex flex-col items-start gap-1.5"
              >
                <span
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: on ? 34 : 20,
                    backgroundColor: seen
                      ? "var(--brand-ink)"
                      : "var(--border-strong)",
                  }}
                />
                <span
                  className="text-[11.5px] whitespace-nowrap transition-colors"
                  style={{
                    color: on ? "var(--text-hi)" : "var(--text-low)",
                    fontWeight: on ? 600 : 400,
                  }}
                >
                  {s.stage}
                </span>
              </button>
            );
          })}
        </div>

        {/* En pantallas angostas no cabe el riel: queda el contador. */}
        <span className="num text-[12px] text-low sm:hidden">
          {current.stage} · {i + 1}/{SLIDES.length}
        </span>

        <Button
          onClick={() => (last ? onDone() : go(i + 1))}
          iconRight={<ArrowRight className="h-4 w-4" />}
        >
          {last ? "Entrar" : "Siguiente"}
        </Button>
      </div>
    </motion.div>
  );
}
