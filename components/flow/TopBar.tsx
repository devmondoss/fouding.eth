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
      className="relative z-30 flex h-[60px] shrink-0 items-center justify-between border-b border-border bg-surface px-8"
    >
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="flex items-center gap-2"
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-[6px]"
          style={{ backgroundColor: "var(--brand)" }}
        >
          <Asterisk
            className="h-4 w-4"
            style={{ color: "var(--brand-ink)" }}
            strokeWidth={2.6}
          />
        </span>
        <span className="h2 text-[19px]">Founding</span>
      </motion.div>

      <div className="flex items-center gap-2.5">
        <motion.button
          {...press}
          onClick={onReplayIntro}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors hover:bg-surface-soft"
          title="Ver cómo funciona"
          aria-label="Ver cómo funciona"
        >
          <HelpCircle className="h-4 w-4 text-mid" />
        </motion.button>

        <motion.button
          {...press}
          onClick={onOpenFunds}
          className="flex items-center gap-2 rounded-[var(--r-input)] border border-border px-3 py-1.5 transition-colors hover:bg-surface-soft"
        >
          <Wallet className="h-3.5 w-3.5 text-low" />
          <AnimatedNumber
            value={balance}
            className="num text-[13px] font-semibold text-hi"
          />
          <span className="text-[11.5px] text-low">USDC</span>
          <Plus className="h-3 w-3 shrink-0" style={{ color: "var(--brand-ink)" }} />
        </motion.button>

        <motion.button
          {...press}
          onClick={onOpenPortfolio}
          className="flex items-center gap-2 rounded-[var(--r-input)] border border-border py-1.5 pl-2 pr-3 transition-colors hover:bg-surface-soft"
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
          >
            {positions.length}
          </span>
          <span className="text-[13px] text-hi">Portafolio</span>
        </motion.button>

        {/* Cuenta — abre el perfil, que es el módulo dedicado */}
        <motion.button
          {...press}
          onClick={onOpenProfile}
          className="flex h-9 items-center gap-2 rounded-[var(--r-input)] border border-border px-2.5 transition-colors hover:bg-surface-soft"
        >
          {session.verified ? (
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--positive)" }} />
          ) : (
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: "var(--border-strong)" }}
            />
          )}
          <span className="num text-[12px] text-mid">
            {session.address.slice(0, 6)}…{session.address.slice(-4)}
          </span>
        </motion.button>
      </div>
    </motion.header>
  );
}
