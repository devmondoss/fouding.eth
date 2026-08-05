"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Asterisk, HelpCircle, LogOut } from "lucide-react";
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
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:h-[60px] sm:px-6 lg:px-8"
    >
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="flex items-center gap-2"
      >
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
        <span className="h2 hidden text-[19px] sm:inline">Founding</span>
        <span className="ml-1 rounded-[var(--r-pill)] border border-border bg-surface-soft px-2 py-[2px] text-[11px] text-mid">
          Empresas
        </span>
      </motion.div>

      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <Link
          href="/negocios"
          className="hidden h-9 w-9 items-center justify-center rounded-full border border-border transition-colors hover:bg-surface-soft sm:flex"
          title="Cómo funciona"
          aria-label="Cómo funciona"
        >
          <HelpCircle className="h-4 w-4 text-mid" />
        </Link>

        <span className="num hidden items-center rounded-[var(--r-input)] border border-border px-2.5 py-1.5 text-[12px] text-mid sm:inline-flex">
          {shortHash(address)}
        </span>

        <motion.button
          {...press}
          onClick={onSignOut}
          className="flex h-9 items-center gap-1.5 rounded-[var(--r-input)] border border-border px-2.5 text-[12.5px] text-mid transition-colors hover:bg-surface-soft"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Salir</span>
        </motion.button>
      </div>
    </motion.header>
  );
}
