"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Waiting } from "@/components/ui/Waiting";
import { T } from "@/lib/motion";
import type { PasoRevision } from "@/lib/useSession";

/**
 * La revisión de acceso, ocurriendo a la vista.
 *
 * Antes esto pasaba detrás de un botón ocupado: apretabas "Registrar
 * solicitud", el botón barría, y salías con un estado que decía "en
 * revisión" sin que nada explicara qué había ocurrido en el medio. El
 * trámite más técnico del producto era el único invisible.
 *
 * **Los cuatro pasos son reales y en ese orden.** No es una animación
 * decorativa con nombres inventados: dos de ellos son transacciones
 * firmadas en Arbitrum —una por la wallet de la persona, otra por el
 * operador— y por eso tardan lo que tardan. Esa es justamente la razón
 * por la que mostrarlos vale la pena: el tiempo de espera ya existía,
 * y estaba gastado en no contar nada.
 *
 * Lo que NO se hace, no se dibuja. No hay "escaneando documento" ni
 * "contrastando con RENIEC", porque nada de eso ocurre. Lo que hay es lo
 * que hay, y resulta que lo que hay es más interesante.
 */

const PASOS = [
  {
    etapa: "declarando",
    title: "Registrando tu declaración",
    body: "Tus datos quedan fuera de cadena. Solo se calcula su huella.",
  },
  {
    etapa: "registrando",
    title: "Anclando la huella en el contrato",
    body: "Firmado por tu wallet en Arbitrum. Queda la huella, nunca tus datos.",
  },
  {
    etapa: "resolviendo",
    title: "Resolviendo la revisión",
    body: "La decisión se escribe en el registro de acceso, no en una base de datos.",
  },
] as const;

/** En qué posición del recorrido está cada etapa. */
const ORDEN: Record<PasoRevision["etapa"], number> = {
  declarando: 0,
  registrando: 1,
  resolviendo: 2,
  listo: 3,
  fallo: 3,
};

/**
 * Piso de legibilidad de una etapa.
 *
 * No es relleno: es que un paso que se resuelve en 150 ms —el primero
 * suele hacerlo, es una llamada a nuestra propia base— aparece y
 * desaparece antes de que el ojo llegue, y entonces la secuencia
 * completa se lee como un parpadeo. Las dos etapas onchain tardan lo
 * suyo por su cuenta y este piso no las toca; solo evita que las
 * rápidas sean invisibles.
 */
const PISO_MS = 900;

export function RevisionAcceso({ paso }: { paso: PasoRevision }) {
  // La etapa que se MUESTRA va por detrás de la real cuando la real
  // corre más rápido que el ojo, y nunca por delante.
  const [visible, setVisible] = useState<PasoRevision>({ etapa: "declarando" });

  useEffect(() => {
    const destino = ORDEN[paso.etapa];
    const aqui = ORDEN[visible.etapa];

    if (aqui >= destino) {
      // `listo` y `fallo` comparten posición con la última etapa: se
      // adoptan aunque el orden no avance.
      if (paso.etapa !== visible.etapa) setVisible(paso);
      return;
    }

    // **De a un paso.** Adoptar el destino directamente parece lo mismo y
    // no lo es: cuando la red responde rápido, el estado real puede pasar
    // de la primera etapa al final entre dos renders, y la secuencia se
    // saltearía justo las dos etapas onchain que son lo que vale la pena
    // ver. Caminar el recorrido es el punto.
    const t = setTimeout(() => {
      const siguiente = aqui + 1;
      setVisible(
        siguiente >= destino ? paso : { etapa: PASOS[siguiente].etapa },
      );
    }, PISO_MS);
    return () => clearTimeout(t);
  }, [paso, visible]);

  const actual = ORDEN[visible.etapa];
  const terminado = visible.etapa === "listo";
  const fallado = visible.etapa === "fallo";

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col gap-4">
        {PASOS.map((p, i) => {
          const hecho = i < actual;
          const enCurso = i === actual;
          return (
            <li key={p.etapa} className="flex gap-3.5">
              {/* La pista y su avance. Un paso hecho la deja en tinta; el
                  que corre la tiene a medias con la regla que barre; el
                  que no llegó, apagada. Sin glifos: ni palomita ni
                  círculo, que es el reflejo que este sistema ya descartó
                  para todo lo demás (§5.1). */}
              <span
                aria-hidden
                className="mt-1 w-[2px] shrink-0 rounded-full transition-colors duration-300"
                style={{
                  backgroundColor:
                    hecho || enCurso ? "var(--brand-ink)" : "var(--border)",
                }}
              />
              <motion.div
                animate={{ opacity: hecho || enCurso ? 1 : 0.4 }}
                transition={T.base}
                className="min-w-0"
              >
                <span className="block text-[13.5px] font-semibold text-hi">
                  {p.title}
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-mid">
                  {p.body}
                </span>
                {enCurso && !terminado && !fallado && (
                  <span className="mt-2 block">
                    <Waiting label={p.title} width={90} />
                  </span>
                )}
              </motion.div>
            </li>
          );
        })}
      </ol>

      <AnimatePresence mode="wait">
        {terminado && (
          <motion.div
            key="listo"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={T.spring}
            className="rounded-[var(--r-panel)] border px-3.5 py-3"
            style={{ borderColor: "var(--positive)" }}
          >
            <div
              className="text-[13px] font-semibold"
              style={{ color: "var(--positive)" }}
            >
              Acceso aprobado
            </div>
            {/* La línea que no se puede omitir. Aprobar a todo el mundo en
                cuatro segundos y no decir que fue automático sería vender
                una verificación que no ocurrió. */}
            <p className="mt-1 text-[12px] leading-relaxed text-mid">
              La resolución fue automática, no humana. En producción este
              paso lo hace una persona contra tu documento.
            </p>
          </motion.div>
        )}

        {fallado && (
          <motion.div
            key="fallo"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={T.base}
            role="alert"
            className="rounded-[var(--r-panel)] border px-3.5 py-3"
            style={{ borderColor: "var(--warning)" }}
          >
            <div
              className="text-[13px] font-semibold"
              style={{ color: "var(--warning)" }}
            >
              Quedó en revisión
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-mid">
              {visible.etapa === "fallo" && visible.motivo} Se resuelve sola al volver a entrar, o la aprueba
              una persona.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
