"use client";

import { motion } from "motion/react";
import { Asterisk, HelpCircle, Plus, ShieldCheck, Wallet } from "lucide-react";
import { usePlatform } from "@/lib/data/store";
import type { Session } from "@/lib/useSession";
import { fadeUp, press, T } from "@/lib/motion";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

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
      </motion.div>

      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <motion.button
          {...press}
          onClick={onReplayIntro}
          className="hidden h-9 w-9 items-center justify-center rounded-full border border-border transition-colors hover:bg-surface-soft sm:flex"
          title="Ver cómo funciona"
          aria-label="Ver cómo funciona"
        >
          <HelpCircle className="h-4 w-4 text-mid" />
        </motion.button>

        <motion.button
          {...press}
          onClick={onOpenFunds}
          className="flex items-center gap-1.5 rounded-[var(--r-input)] border border-border px-2 py-1.5 transition-colors hover:bg-surface-soft sm:gap-2 sm:px-3"
        >
          <Wallet className="h-3.5 w-3.5 shrink-0 text-low" />
          <AnimatedNumber
            value={balance}
            className="num text-[12.5px] font-semibold text-hi sm:text-[13px]"
          />
          <span className="hidden text-[11.5px] text-low sm:inline">USDC</span>
          <Plus className="h-3 w-3 shrink-0" style={{ color: "var(--brand-ink)" }} />
        </motion.button>

        <motion.button
          {...press}
          onClick={onOpenPortfolio}
          className="flex items-center gap-2 rounded-[var(--r-input)] border border-border py-1.5 pl-2 pr-2 transition-colors hover:bg-surface-soft sm:pr-3"
          aria-label="Portafolio"
        >
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
          >
            {positions.length}
          </span>
          <span className="hidden text-[13px] text-hi sm:inline">Portafolio</span>
        </motion.button>

        {/* Cuenta — abre el perfil, que es el módulo dedicado */}
        <motion.button
          {...press}
          onClick={onOpenProfile}
          className="flex h-9 items-center gap-2 rounded-[var(--r-input)] border border-border px-2.5 transition-colors hover:bg-surface-soft"
          aria-label="Cuenta"
        >
          {session.verified ? (
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--positive)" }} />
          ) : (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: "var(--border-strong)" }}
            />
          )}
          <span className="num hidden text-[12px] text-mid sm:inline">
            {session.address.slice(0, 6)}…{session.address.slice(-4)}
          </span>
        </motion.button>
      </div>
    </motion.header>
  );
}
