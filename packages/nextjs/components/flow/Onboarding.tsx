"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { useLayerKeys } from "@/lib/keyboard";
import { scrim, slide } from "@/lib/motion";
import {
  MIN_REQUESTED_USDC,
  MIN_YEARS_OPERATING,
  REVIEW_SLA_DAYS,
  TERM_PRESETS,
} from "@/lib/verifier/submission";

/**
 * Explicación del producto en pasos. Se muestra UNA sola vez por navegador
 * (ver useOnce). Después no vuelve a aparecer: quien ya entendió cómo
 * funciona no debería volver a leerlo.
 */

/** El nombre de la etapa vive en el riel de pasos, no como antetítulo
 *  encima del titular: ahí solo repetía en pequeño lo que los puntos ya
 *  decían, y dejaba la navegación como cuatro puntos sin nombre.
 *
 *  Cada paso tenía además un ícono de librería en un cuadro chartreuse
 *  —oficina, documento, banco, billetera— que no agregaba nada al titular
 *  y ponía la estampa de "cuatro tarjetas con ícono" en la primera
 *  pantalla del producto. El titular sostiene solo. */
export type Slide = { stage: string; title: string; body: string };

/** Lo que necesita entender quien pone el capital. */
export const SLIDES_INVERSIONISTA: Slide[] = [
  {
    stage: "El origen",
    title: "Empresas que ya facturan",
    body: `PyMEs peruanas con al menos ${MIN_YEARS_OPERATING} años operando y ventas comprobables piden capital para un proyecto concreto: una máquina, una flota, una planta. No para caja general.`,
  },
  {
    stage: "El filtro",
    title: "Se verifica antes de publicar",
    body: "Revisamos ventas, titularidad del activo y gravámenes previos. Al valor del activo se le aplica un castigo y solo publicamos si lo que quedaría al liquidarlo cubre el préstamo.",
  },
  {
    stage: "El desembolso",
    title: "Capital bajo custodia contractual",
    body: "El capital queda en un contrato en Arbitrum y se libera por tramos únicamente cuando la empresa demuestra el cumplimiento verificado de cada hito del proyecto.",
  },
  {
    stage: "El retorno",
    title: "Prelación de pagos definida desde el inicio",
    body: "El inversionista recibe capital e interés según el cronograma pactado. Ante un incumplimiento, se ejecuta la garantía y el monto recuperado se distribuye según un orden de prelación contractual. El recupero puede ser parcial.",
  },
];

/**
 * Lo que necesita entender quien pide. No existía: el dueño de negocio
 * entraba directo a un panel con un botón de "Acreditar mi empresa" y
 * ninguna explicación de por qué hay dos trámites, qué se le va a pedir
 * ni cómo le llega la plata. La misma cortesía que se le hace al
 * inversionista, del otro lado del mercado.
 *
 * Las cifras salen de las mismas constantes que validan el formulario
 * (lib/verifier/submission.ts): si mañana el mínimo sube, esta pantalla
 * no queda mintiendo.
 */
export const SLIDES_EMPRESA: Slide[] = [
  {
    stage: "Qué financiamos",
    title: "Capital para un proyecto, no para caja",
    body: `Una máquina, una flota, una planta: algo que puedas nombrar y demostrar. Desde ${MIN_REQUESTED_USDC.toLocaleString("es-PE")} USDC y a ${TERM_PRESETS[0]} a ${TERM_PRESETS[TERM_PRESETS.length - 1]} meses, a una tasa fija que define el verificador.`,
  },
  {
    stage: "La acreditación",
    title: "Tu empresa se acredita una sola vez",
    body: `RUC vigente, al menos ${MIN_YEARS_OPERATING} años operando y tus ventas del último año. Un verificador lo revisa y tu empresa recibe un pasaporte onchain. Después de eso, cada solicitud es solo el proyecto: no vuelves a teclear nada de la empresa.`,
  },
  {
    stage: "La garantía",
    title: "Un activo tuyo respalda el crédito",
    body: "Maquinaria, vehículo o inmueble, inscrito y sin gravámenes. A la tasación se le aplica un castigo por tipo de activo y solo se publica si lo que quedaría al liquidarlo cubre lo que pides. Tu aporte propio se pierde antes que el del inversionista.",
  },
  {
    stage: "El dinero",
    title: "Llega por hitos, no de golpe",
    body: `El capital queda en un contrato y se libera cuando demuestras cada hito. Te responden en ${REVIEW_SLA_DAYS} días hábiles, y si te rechazan te dicen por escrito qué corregir para volver a enviarlo.`,
  },
];

export function Onboarding({
  onDone,
  slides = SLIDES_INVERSIONISTA,
}: {
  onDone: () => void;
  /** Qué recorrido se explica. Ver SLIDES_EMPRESA. */
  slides?: Slide[];
}) {
  const SLIDES = slides;
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const last = i === SLIDES.length - 1;

  const go = (next: number) => {
    setDir(next > i ? 1 : -1);
    setI(next);
  };

  const current = SLIDES[i];

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
          Árbitro
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
            <h2 className="h1 text-[26px] sm:text-[38px]">{current.title}</h2>

            <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-relaxed text-mid">
              {current.body}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controles */}
      <div className="flex h-20 shrink-0 items-center justify-between px-5 sm:h-[92px] sm:px-8">
        <Button variant="ghost" onClick={() => go(i - 1)} disabled={i === 0}>
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

        <Button onClick={() => (last ? onDone() : go(i + 1))}>
          {last ? "Entrar" : "Siguiente"}
        </Button>
      </div>
    </motion.div>
  );
}
