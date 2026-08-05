"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Asterisk, Check } from "lucide-react";
import { fadeUp, stagger, T } from "@/lib/motion";

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

const BULLETS = [
  {
    title: "Revisión humana",
    detail:
      "Un verificador lee tu expediente. No es un algoritmo que te rechaza sin explicación.",
  },
  {
    title: "Sin intermediarios bancarios",
    detail:
      "El capital viene directo de inversionistas verificados en la plataforma.",
  },
  {
    title: "Desembolso en USDC",
    detail:
      "Tu wallet queda habilitada en cuanto se aprueba el expediente, sobre Arbitrum.",
  },
];

const PASOS = [
  "Creas tu cuenta con tu correo — te generamos la wallet al instante",
  "Cuentas tu proyecto y subes el expediente legal",
  "Un verificador lo revisa y, si aprueba, tu operación se publica",
];

export function BusinessLanding() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-5 sm:h-[60px] sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px]"
            style={{ backgroundColor: "var(--brand)" }}
          >
            <Asterisk
              className="h-4 w-4"
              style={{ color: "var(--brand-ink)" }}
              strokeWidth={2.6}
            />
          </span>
          <span className="h2 text-[19px]">Founding</span>
          <span className="ml-1 rounded-[var(--r-pill)] border border-border bg-surface-soft px-2 py-[2px] text-[11px] text-mid">
            Empresas
          </span>
        </Link>

        <Link
          href="/solicitar"
          className="text-[13px] font-medium underline decoration-dotted transition-colors hover:text-hi"
          style={{ color: "var(--brand-ink)" }}
        >
          Entrar
        </Link>
      </header>

      <main className="mx-auto max-w-[860px] px-5 py-12 sm:px-8 sm:py-16">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <div className="label">Para empresas</div>
          <h1 className="h1 mt-2 max-w-[620px] text-[30px] leading-[1.08] sm:text-[38px]">
            Financia tu próxima etapa con crédito privado
          </h1>
          <p className="mt-3 max-w-[540px] text-[14.5px] leading-relaxed text-mid">
            Publica tu proyecto, sube tu expediente legal y conecta con
            inversionistas que respaldan operaciones con garantía real, en USDC
            sobre Arbitrum.
          </p>

          <Link
            href="/solicitar"
            className="mt-7 inline-flex h-11 items-center gap-2 rounded-[var(--r-input)] px-5 text-[14px] font-medium shadow-[var(--shadow-sm)] transition-[filter] hover:brightness-110"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
          >
            Comenzar
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <motion.div
          variants={stagger()}
          initial="hidden"
          animate="show"
          className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {BULLETS.map((b) => (
            <motion.div key={b.title} variants={fadeUp} className="card p-4">
              <div className="flex items-center gap-2">
                <Check
                  className="h-4 w-4 shrink-0"
                  style={{ color: "var(--positive)" }}
                />
                <span className="text-[13.5px] font-semibold text-hi">
                  {b.title}
                </span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-mid">
                {b.detail}
              </p>
            </motion.div>
          ))}
        </motion.div>

        <motion.section
          variants={fadeUp}
          initial="hidden"
          animate="show"
          transition={T.base}
          className="card mt-4 p-5 sm:p-6"
        >
          <h2 className="h3">Cómo funciona</h2>
          <ol className="mt-3.5 flex flex-col gap-3">
            {PASOS.map((paso, i) => (
              <li key={paso} className="flex items-start gap-3">
                <span
                  className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11.5px] font-semibold"
                  style={{
                    borderColor: "var(--brand-border)",
                    color: "var(--brand-ink)",
                  }}
                >
                  {i + 1}
                </span>
                <span className="text-[13.5px] leading-relaxed text-mid">
                  {paso}
                </span>
              </li>
            ))}
          </ol>
        </motion.section>

        <Link
          href="/"
          className="mt-8 inline-block text-[12.5px] text-low transition-colors hover:text-hi"
        >
          ← Volver a Founding
        </Link>
      </main>
    </div>
  );
}
