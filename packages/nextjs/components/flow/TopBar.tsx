"use client";

import { motion } from "motion/react";
import { usePlatform } from "@/lib/data/store";
import type { Session } from "@/lib/useSession";
import { fadeUp, press, T } from "@/lib/motion";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Wordmark } from "@/components/ui/Logo";

/**
 * Barra del inversionista. Ningún control lleva glifo: la ayuda dice "Cómo
 * funciona", el saldo dice "Agregar" y la cuenta dice si tiene acceso o no.
 * Antes eran cuatro íconos de librería —interrogación, billetera, más y dos
 * escudos— para cuatro cosas que se nombran en dos palabras cada una.
 */
export function TopBar({
  session,
  onOpenPortfolio,
  onOpenProfile,
  onOpenFunds,
  onReplayIntro,
}: {
  session: Session;
  onOpenPortfolio: () => void;
  onOpenProfile: () => void;
  onOpenFunds: () => void;
  onReplayIntro: () => void;
}) {
  const { balance, positions } = usePlatform();

  return (
    <motion.header
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...T.base, delay: 0.05 }}
      className="relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:h-[60px] sm:px-6 lg:px-8"
    >
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <Wordmark />
      </motion.div>

      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <motion.button
          {...press}
          onClick={onReplayIntro}
          className="focusable hidden h-9 items-center rounded-[var(--r-input)] px-2.5 text-[12.5px] text-mid transition-colors hover:bg-surface-soft hover:text-hi sm:flex"
        >
          Cómo funciona
        </motion.button>

        {/* El saldo y su recarga son un solo objetivo: la cifra es el dato y
            "Agregar" es la acción. El más y la billetera decían lo mismo dos
            veces y ninguna de las dos con palabras. */}
        <motion.button
          {...press}
          onClick={onOpenFunds}
          className="focusable flex h-9 items-center gap-2 rounded-[var(--r-input)] border border-border px-2.5 transition-colors hover:bg-surface-soft"
        >
          <AnimatedNumber
            value={balance}
            className="num text-[12.5px] font-semibold text-hi sm:text-[13px]"
          />
          <span className="hidden text-[11.5px] text-low sm:inline">USDC</span>
          <span
            className="hidden border-l border-border pl-2 text-[12px] font-medium sm:inline"
            style={{ color: "var(--brand-ink)" }}
          >
            Agregar
          </span>
        </motion.button>

        <motion.button
          {...press}
          onClick={onOpenPortfolio}
          className="focusable flex h-9 items-center gap-2 rounded-[var(--r-input)] border border-border py-1.5 pl-2 pr-2 transition-colors hover:bg-surface-soft sm:pr-3"
          aria-label="Portafolio"
        >
          <span
            className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
          >
            {positions.length}
          </span>
          <span className="hidden text-[13px] text-hi sm:inline">Portafolio</span>
        </motion.button>

        {/* El estado de verificación gobierna si puedes invertir. Se dice con
            la palabra, en los dos sentidos: "Con acceso" y "Sin acceso" son
            el mismo control diciendo cosas opuestas, no un escudo verde
            contra un escudo gris. */}
        <motion.button
          {...press}
          onClick={onOpenProfile}
          className="focusable flex h-9 items-center gap-2 rounded-[var(--r-input)] border border-border px-2.5 transition-colors hover:bg-surface-soft"
          aria-label={
            session.verified
              ? "Cuenta — acceso de inversionista aprobado"
              : "Cuenta — acceso de inversionista pendiente"
          }
        >
          <span
            className="hidden text-[12px] font-medium sm:inline"
            style={{
              color: session.verified ? "var(--positive)" : "var(--text-mid)",
            }}
          >
            {session.verified ? "Con acceso" : "Sin acceso"}
          </span>
          <span className="num text-[12px] text-mid">
            {session.address.slice(0, 6)}…{session.address.slice(-4)}
          </span>
        </motion.button>
      </div>
    </motion.header>
  );
}
