"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Logo } from "@/components/ui/Logo";
import { fadeUp, T } from "@/lib/motion";

/**
 * Página pública "Founding para empresas" — vive en /negocios, con URL
 * propia y permanente.
 *
 * Deliberadamente NO es un paso del flujo de /solicitar: antes se
 * mostraba como interstitial gateado por localStorage, así que reaparecía
 * encima de la aplicación de gente que ya se había registrado y no tenía
 * forma estable de volver a leerse. Una página de venta se visita, no se
 * atraviesa (ver conversación de agosto 2026).
 */

/* Antes acá había tres tarjetas del mismo tamaño con ícono, título y texto
   —la estructura de página más genérica que existe, y la que el piso de
   calidad marca como contenedor perezoso— diciendo cosas que el dueño de un
   negocio no puede accionar ("desembolso en USDC").

   Lo que sí necesita antes de gastar una tarde armando un expediente es
   saber si califica. Son los criterios reales del producto, no una promesa. */
const REQUISITOS = [
  {
    label: "Dos años de operación como mínimo",
    detail: "Con RUC activo y habido. Se verifica en la consulta pública.",
  },
  {
    label: "Ventas que se puedan comprobar",
    detail:
      "Comprobantes electrónicos o reporte tributario. Tú los entregas; no accedemos a nada por nuestra cuenta.",
  },
  {
    label: "Un activo propio como garantía",
    detail:
      "Maquinaria, vehículo o inmueble, sin gravámenes previos e inscribible en registro público.",
  },
  {
    label: "Un proyecto concreto, no capital de trabajo general",
    detail:
      "Una máquina, una flota, una planta. Con plazo de 8 a 12 meses y un cronograma de hitos.",
  },
];

const PASOS = [
  {
    title: "Creas tu cuenta con tu correo",
    detail:
      "Sin contraseñas ni instalar nada. Te generamos la cuenta que recibe el dinero al instante.",
  },
  {
    title: "Cuentas tu proyecto y subes el expediente",
    detail:
      "Monto, plazo, para qué es y con qué activo lo respaldas. Los documentos quedan en almacenamiento privado.",
  },
  {
    title: "Un verificador lee tu expediente",
    detail:
      "Una persona, no un algoritmo. Cobra un honorario fijo por revisar, igual si aprueba o si rechaza — así nadie tiene incentivo a aprobarte de más.",
  },
  {
    title: "Si aprueba, tu operación sale al catálogo",
    detail:
      "Los inversionistas la fondean. El dinero queda retenido en el contrato y te llega por tramos, a medida que cumples cada hito.",
  },
];

export function BusinessLanding() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-5 sm:h-[60px] sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="h2 text-[19px]">Founding</span>
          <span className="ml-1 rounded-[var(--r-pill)] border border-border bg-surface-soft px-2 py-[2px] text-[11px] text-mid">
            Empresas
          </span>
        </Link>

        <Link
          href="/solicitar"
          className="focusable -mx-2 inline-flex h-9 items-center px-2 text-[13px] font-medium underline decoration-dotted transition-colors hover:text-hi"
          style={{ color: "var(--brand-ink)" }}
        >
          Entrar
        </Link>
      </header>

      <main className="mx-auto max-w-[var(--w-doc)] px-5 py-12 sm:px-8 sm:py-16">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <h1 className="h1 max-w-[640px] text-[30px] leading-[1.08] sm:text-[38px]">
            Tu maquinaria vale. Úsala para financiar
            <br className="hidden sm:block" /> tu próximo proyecto.
          </h1>
          <p className="mt-3.5 max-w-[560px] text-[14.5px] leading-relaxed text-mid">
            Si tu empresa ya factura y tiene un activo propio, puedes financiar
            un proyecto concreto con capital de inversionistas verificados —
            sin pasar por un banco. Una persona revisa tu expediente y te dice
            por qué, apruebe o rechace.
          </p>

          <Link
            href="/solicitar"
            className="focusable mt-7 inline-flex h-11 items-center rounded-[var(--r-input)] px-5 text-[14px] font-medium shadow-[var(--shadow-sm)] transition-[filter] hover:brightness-110"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
          >
            Empezar mi solicitud
          </Link>
        </motion.div>

        {/* Antes de gastar una tarde armando un expediente, lo primero que
            un dueño necesita saber es si califica. */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          animate="show"
          transition={T.base}
          className="card mt-11 p-5 sm:p-6"
        >
          <h2 className="h3">Qué necesitas para calificar</h2>
          <p className="mt-1 text-[12.5px] text-mid">
            Si te falta alguno de los cuatro, todavía no es el momento.
          </p>
          <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
            {REQUISITOS.map((r) => (
              // El check verde por requisito leía como "ya lo cumples", que
              // es lo contrario de lo que esta lista pregunta.
              <li key={r.label} className="flex items-start gap-2.5">
                <span className="marker mt-[7px]" />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-hi">
                    {r.label}
                  </div>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-mid">
                    {r.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section
          variants={fadeUp}
          initial="hidden"
          animate="show"
          transition={T.base}
          className="card mt-4 p-5 sm:p-6"
        >
          <h2 className="h3">Cómo funciona</h2>
          {/* La secuencia numerada se queda porque el orden es información:
              son cuatro pasos que ocurren uno después del otro. El borde iba
              en --brand-border, que mide 1.26:1 y no se veía. */}
          <ol className="mt-4 flex flex-col gap-4">
            {PASOS.map((paso, i) => (
              <li key={paso.title} className="flex items-start gap-3.5">
                <span
                  className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11.5px] font-semibold"
                  style={{
                    borderColor: "var(--brand-ink)",
                    color: "var(--brand-ink)",
                  }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-hi">
                    {paso.title}
                  </div>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-mid">
                    {paso.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </motion.section>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="show"
          transition={T.base}
          className="mt-4 rounded-[var(--r-panel)] border border-border px-5 py-4 text-[12.5px] leading-relaxed text-mid"
        >
          Founding está en versión de prueba: opera sobre una red de pruebas y
          todavía no mueve dinero real. Tus documentos quedan en
          almacenamiento privado — de la cadena solo queda su huella
          criptográfica, nunca el archivo.
        </motion.p>

        <Link
          href="/"
          className="focusable -mx-2 mt-7 inline-flex h-9 items-center px-2 text-[12.5px] text-mid transition-colors hover:text-hi"
        >
          ← Volver a Founding
        </Link>
      </main>
    </div>
  );
}
