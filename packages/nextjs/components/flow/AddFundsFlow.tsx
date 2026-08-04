"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Loader2, Wallet, X } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Button } from "@/components/ui/Button";
import { usePlatform } from "@/lib/data/store";
import { formatUsdc, usdc } from "@/lib/format";
import { dialog, scrim, T } from "@/lib/motion";

const MONTOS = [500, 1_000, 5_000, 10_000];
const PASOS = ["Confirmando en Arbitrum", "Actualizando saldo"];

type Step = "monto" | "procesando" | "listo";

/** Módulo dedicado para recargar saldo. No comparte pantalla con nada más. */
export function AddFundsFlow({ onClose }: { onClose: () => void }) {
  const { balance, addFunds } = usePlatform();
  const [step, setStep] = useState<Step>("monto");
  const [amount, setAmount] = useState("1000");
  const [progress, setProgress] = useState(0);
  const [balanceBefore] = useState(balance);

  const parsed = Number(amount.replace(/[^0-9.]/g, "")) || 0;
  const value = usdc(parsed);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (step !== "procesando") return;
    setProgress(0);
    const t1 = setTimeout(() => setProgress(1), 550);
    const t2 = setTimeout(async () => {
      await addFunds(value);
      setStep("listo");
    }, 1100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <motion.div
      variants={scrim}
      initial="hidden"
      animate="show"
      exit="exit"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
      style={{ backgroundColor: "rgba(16,24,40,0.4)" }}
      onClick={step === "monto" ? onClose : undefined}
    >
      <motion.div
        variants={dialog}
        initial="hidden"
        animate="show"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[380px] overflow-hidden rounded-[var(--r-card)] border border-border bg-surface shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="h2 text-[16px]">Agregar fondos</h2>
          {step === "monto" && (
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border transition-colors hover:bg-surface-soft"
              aria-label="Cerrar"
            >
              <X className="h-3.5 w-3.5 text-mid" />
            </button>
          )}
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {step === "monto" && (
              <motion.div
                key="monto"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={T.fast}
              >
                <div className="label">Saldo actual</div>
                <div className="num mt-1 text-[22px] font-bold text-hi">
                  {formatUsdc(balance)} <span className="text-[13px] text-low">USDC</span>
                </div>

                <label className="mt-5 block">
                  <span className="text-[12.5px] font-medium text-hi">Monto a agregar</span>
                  <span className="mt-1.5 flex items-center gap-2 rounded-[var(--r-input)] border border-border bg-surface px-3 transition-colors focus-within:border-[var(--brand-ink)]">
                    <input
                      autoFocus
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="num h-11 w-full bg-transparent text-[16px] text-hi outline-none"
                    />
                    <span className="text-[12.5px] text-low">USDC</span>
                  </span>
                </label>

                <div className="mt-2.5 grid grid-cols-4 gap-2">
                  {MONTOS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setAmount(String(m))}
                      className="num rounded-[var(--r-input)] border border-border bg-surface py-1.5 text-[11.5px] text-mid transition-colors hover:border-[var(--brand-ink)] hover:text-[var(--brand-ink)]"
                    >
                      {m.toLocaleString("es-PE")}
                    </button>
                  ))}
                </div>

                <Button
                  className="mt-5 w-full"
                  size="lg"
                  disabled={parsed <= 0}
                  onClick={() => setStep("procesando")}
                  iconRight={<ArrowRight className="h-4 w-4" />}
                >
                  Confirmar
                </Button>
              </motion.div>
            )}

            {step === "procesando" && (
              <motion.div
                key="procesando"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={T.fast}
                className="py-2"
              >
                <div className="flex flex-col gap-3.5">
                  {PASOS.map((label, i) => {
                    const done = i < progress;
                    const active = i === progress;
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full border"
                          style={{
                            borderColor: done
                              ? "var(--positive)"
                              : active
                                ? "var(--brand-ink)"
                                : "var(--border)",
                            backgroundColor: done ? "var(--positive)" : "transparent",
                          }}
                        >
                          {done ? (
                            <Check className="h-3 w-3 text-white" strokeWidth={3} />
                          ) : active ? (
                            <Loader2
                              className="h-3 w-3 animate-spin"
                              style={{ color: "var(--brand-ink)" }}
                            />
                          ) : null}
                        </span>
                        <span
                          className="text-[13.5px]"
                          style={{
                            color: done || active ? "var(--text-hi)" : "var(--text-low)",
                          }}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === "listo" && (
              <motion.div
                key="listo"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={T.base}
                className="flex flex-col items-center py-3 text-center"
              >
                <motion.span
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ ...T.spring, delay: 0.05 }}
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--positive-soft)" }}
                >
                  <Wallet className="h-5 w-5" style={{ color: "var(--positive)" }} />
                </motion.span>

                <div className="mt-3 text-[13px] text-mid">Nuevo saldo</div>
                <AnimatedNumber
                  value={balance}
                  from={balanceBefore}
                  className="num text-[28px] font-bold text-hi"
                  suffix=" USDC"
                />

                <Button className="mt-5 w-full" onClick={onClose}>
                  Listo
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
