"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Wordmark } from "@/components/ui/Logo";
import { fadeUp, press, T } from "@/lib/motion";
import { shortHash } from "@/lib/format";

/**
 * Barra del lado empresa. Espeja TopBar del inversionista para que el
 * producto se sienta uno solo, pero sin saldo ni portafolio: acá no se
 * invierte, se solicita. Su razón de existir es que el dueño de negocio
 * tenga una casa fija — antes la pantalla cambiaba de identidad según
 * un flag de localStorage (ver conversación de agosto 2026).
 */
export function BusinessTopBar({
  address,
  onSignOut,
}: {
  address: string;
  onSignOut: () => void;
}) {
  return (
    <motion.header
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...T.base, delay: 0.05 }}
      className="frosted sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border px-4 sm:h-[60px] sm:px-6 lg:px-8"
    >
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <Wordmark suffix="Empresas" />
      </motion.div>

      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <Link
          href="/negocios"
          className="focusable hidden h-9 items-center rounded-[var(--r-input)] px-2.5 text-[12.5px] text-mid transition-colors hover:bg-surface-soft hover:text-hi sm:flex"
        >
          Cómo funciona
        </Link>

        <span className="num hidden items-center rounded-[var(--r-input)] border border-border px-2.5 py-1.5 text-[12px] text-mid sm:inline-flex">
          {shortHash(address)}
        </span>

        <motion.button
          {...press}
          onClick={onSignOut}
          className="focusable flex h-9 items-center rounded-[var(--r-input)] border border-border px-2.5 text-[12.5px] text-mid transition-colors hover:bg-surface-soft"
        >
          Salir
        </motion.button>
      </div>
    </motion.header>
  );
}
