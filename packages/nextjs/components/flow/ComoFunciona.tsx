"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { T } from "@/lib/motion";

/**
 * Cómo funciona, contándose solo. Vive únicamente en el login de empresa.
 *
 * En esa pantalla la columna derecha eran tres frases sueltas —"sin
 * contraseñas", "lo revisa una persona", "la wallet recibe el
 * desembolso"— todas ciertas y ninguna ordenada. Respondían objeciones,
 * que es otra cosa que explicar el recorrido: quien llega a conectar su
 * empresa no sabe qué pasa después de conectar, y esa es justo la
 * pregunta que lo tiene con el dedo encima del botón.
 *
 * Ahora es el recorrido, en orden, y las tres frases no se perdieron:
 * viven dentro del paso al que pertenecen.
 *
 * **El movimiento orienta, no entretiene** (docs/design-system.md §7). No
 * hay nada que aparezca ni desaparezca: los cuatro pasos están siempre
 * visibles y a la misma altura, así que no se mueve el layout. Lo único
 * que se desplaza es la marca del paso activo, con el mismo `layoutId` y
 * el mismo `T.indicator` que el subrayado de las pestañas del producto —
 * y el contraste, que sube en el activo y baja en el resto. Se lee de un
 * vistazo aunque nunca mires la animación.
 */

const PASOS = [
  {
    title: "Creas tu cuenta con tu correo",
    body: "Te generamos la wallet al instante. Sin contraseñas ni frase semilla que perder.",
  },
  {
    title: "Armas el expediente de tu empresa",
    body: "Ventas comprobables, el activo que dejas en garantía y el proyecto que quieres financiar.",
  },
  {
    title: "Una persona lo revisa",
    body: "No un bot. Cobra lo mismo apruebe o rechace, y si rechaza te dice por qué.",
  },
  {
    title: "Se publica y se recauda",
    body: "Inversionistas ponen el capital y llega a esa misma wallet por tramos, según avanza el proyecto.",
  },
];

/** Lo que tarda en leerse un paso sin apurarse. Más corto se siente
 *  nervioso al lado de un formulario; más largo y deja de leerse como
 *  una secuencia. */
const PASO_MS = 3200;

export function ComoFunciona({ pausado = false }: { pausado?: boolean }) {
  const [activo, setActivo] = useState(0);
  const [quieto, setQuieto] = useState(false);

  // Quien pidió menos movimiento no ve una secuencia que avanza sola: ve
  // los cuatro pasos, todos legibles, y ninguno destacado.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setQuieto(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setQuieto(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Se detiene mientras la persona está conectando o leyendo un error: es
  // el momento en que la pantalla tiene algo más importante que decir, y
  // algo moviéndose al costado compite con eso.
  useEffect(() => {
    if (quieto || pausado) return;
    const t = setInterval(() => {
      setActivo((i) => (i + 1) % PASOS.length);
    }, PASO_MS);
    return () => clearInterval(t);
  }, [quieto, pausado]);

  return (
    <ol className="flex flex-col gap-5">
      {PASOS.map((p, i) => {
        const on = !quieto && i === activo;
        return (
          <li key={p.title} className="relative flex gap-4">
            {/* La pista y la marca que la recorre. Es el mismo gesto que
                `Waiting` usa para la espera: una regla que se desplaza,
                no un punto que se enciende. */}
            <span
              aria-hidden
              className="relative mt-1 w-[2px] shrink-0 rounded-full"
              style={{ backgroundColor: "var(--border)" }}
            >
              {on && (
                <motion.span
                  layoutId="como-funciona-marca"
                  transition={T.indicator}
                  className="absolute inset-x-0 top-0 h-full rounded-full"
                  style={{ backgroundColor: "var(--brand-ink)" }}
                />
              )}
            </span>

            <div>
              <motion.div
                animate={{ opacity: quieto || on ? 1 : 0.45 }}
                transition={T.base}
              >
                <span className="block text-[13.5px] font-semibold text-hi">
                  {p.title}
                </span>
                <span className="mt-1 block text-[13px] leading-relaxed text-mid">
                  {p.body}
                </span>
              </motion.div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
