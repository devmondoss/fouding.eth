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

/**
 * Explicación del producto en pasos. Se muestra UNA sola vez por navegador
 * (ver useOnce). Después no vuelve a aparecer: quien ya entendió cómo
 * funciona no debería volver a leerlo.
 */

const SLIDES = [
  {
    icon: Building2,
    kicker: "El origen",
    title: "Empresas que ya facturan",
    body: "PyMEs peruanas con al menos dos años operando y ventas comprobables piden capital para un proyecto concreto: una máquina, una flota, una planta. No para caja general.",
  },
  {
    icon: FileCheck2,
    kicker: "El filtro",
    title: "Se verifica antes de publicar",
    body: "Revisamos ventas, titularidad del activo y gravámenes previos. Al valor del activo se le aplica un castigo y solo publicamos si lo que quedaría al liquidarlo cubre el préstamo.",
  },
  {
    icon: Landmark,
    kicker: "El desembolso",
    title: "Capital bajo custodia contractual",
    body: "El capital queda en un contrato en Arbitrum y se libera por tramos únicamente cuando la empresa demuestra el cumplimiento verificado de cada hito del proyecto.",
  },
  {
    icon: Wallet,
    kicker: "El retorno",
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

  const slide = SLIDES[i];
  const Icon = slide.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ backgroundColor: "var(--surface)" }}
    >
      {/* Barra superior */}
      <div className="flex h-[60px] shrink-0 items-center justify-between px-8">
        <span className="text-[15px] font-bold tracking-[-0.02em] text-hi">
          Founding
        </span>
        <button
          onClick={onDone}
          className="text-[13px] text-low transition-colors hover:text-hi"
        >
          Saltar
        </button>
      </div>

      {/* Contenido */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-8">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={i}
            custom={dir}
            initial={{ opacity: 0, x: dir * 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -48 }}
            transition={{ duration: 0.32, ease: [0.22, 0.9, 0.3, 1] }}
            className="w-full max-w-[640px] text-center"
          >
            <motion.span
              layout
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-[14px]"
              style={{ backgroundColor: "var(--brand-soft)" }}
            >
              <Icon className="h-6 w-6" style={{ color: "var(--brand-ink)" }} />
            </motion.span>

            <div className="label mt-6" style={{ color: "var(--brand-ink)" }}>
              {slide.kicker}
            </div>

            <h2 className="h1 mt-2 text-[34px]">{slide.title}</h2>

            <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-relaxed text-mid">
              {slide.body}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controles */}
      <div className="flex h-[92px] shrink-0 items-center justify-between px-8">
        <Button
          variant="ghost"
          onClick={() => go(i - 1)}
          disabled={i === 0}
          icon={<ArrowLeft className="h-4 w-4" />}
        >
          Atrás
        </Button>

        <div className="flex items-center gap-2">
          {SLIDES.map((_, n) => (
            <button
              key={n}
              onClick={() => go(n)}
              aria-label={`Paso ${n + 1}`}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: n === i ? 26 : 6,
                backgroundColor:
                  n === i ? "var(--brand)" : "var(--border-strong)",
              }}
            />
          ))}
        </div>

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
