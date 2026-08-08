"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Info, Loader2, Wallet, X } from "lucide-react";
import type { Address } from "viem";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Button } from "@/components/ui/Button";
import { useProtocolToken } from "@/hooks/useProtocolToken";
import { usePlatform } from "@/lib/data/store";
import { useSession } from "@/lib/useSession";
import { formatPen, formatUsdc, MOCK_PEN_PER_USD, penToUsdc, usdc } from "@/lib/format";
import { useLayerKeys } from "@/lib/keyboard";
import { dialog, scrim, T } from "@/lib/motion";

const MONTOS = [500, 1_000, 5_000, 10_000];
const MONTOS_PEN = [500, 2_000, 5_000, 20_000];

type Step = "monto" | "procesando" | "listo";
type Moneda = "usdc" | "pen";
type MetodoPago = "yape" | "plin" | "tarjeta";

const METODOS: { key: MetodoPago; label: string }[] = [
  { key: "yape", label: "Yape" },
  { key: "plin", label: "Plin" },
  { key: "tarjeta", label: "Tarjeta" },
];

/**
 * Módulo dedicado para conseguir saldo. Siempre dice en cuál de los
 * modos está:
 *
 *   faucet       MockUSDC desplegado en la red configurada (devnet):
 *                transacción real, monto fijo del contrato, se espera el
 *                receipt.
 *   depósito     token real canónico (Circle USDC en Arbitrum Sepolia):
 *                no hay faucet, se muestra la dirección para depositar y
 *                el saldo se lee directo onchain.
 *   simulación   sin contrato al que llamar: suma el saldo local. Dentro de
 *                este modo se puede simular además la rampa fiat (PEN vía
 *                Yape/Plin/Tarjeta, docs/pendientes.md bloque 5): no hay
 *                proveedor real conectado, el tipo de cambio es fijo
 *                (lib/format.ts::MOCK_PEN_PER_USD) y el saldo se acredita
 *                con el mismo addFunds() de siempre.
 */
export function AddFundsFlow({ onClose }: { onClose: () => void }) {
  const { balance, addFunds } = usePlatform();
  const { session } = useSession();
  const token = useProtocolToken(session?.address as Address | undefined);
  const canFaucet = Boolean(token.faucetCapable && token.address && session?.address);
  const canDeposit = Boolean(!token.faucetCapable && token.address && session?.address);

  const [step, setStep] = useState<Step>("monto");
  const [amount, setAmount] = useState("1000");
  const [moneda, setMoneda] = useState<Moneda>("usdc");
  const [metodo, setMetodo] = useState<MetodoPago>("yape");
  const [progress, setProgress] = useState(0);
  const [balanceBefore] = useState(balance);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(amount.replace(/[^0-9.]/g, "")) || 0;
  const value = moneda === "pen" ? penToUsdc(parsed) : usdc(parsed);

  const metodoLabel = METODOS.find((m) => m.key === metodo)?.label ?? "";
  const pasos = canFaucet
    ? ["Firmando la transacción", "Esperando confirmación en la red"]
    : moneda === "pen"
      ? [`Confirmando el pago con ${metodoLabel} (simulado)`, "Acreditando USDC"]
      : ["Actualizando saldo de demostración"];

  useLayerKeys({ onEscape: onClose });

  useEffect(() => {
    if (step !== "procesando") return;
    let alive = true;
    setProgress(0);
    setError(null);

    (async () => {
      try {
        if (canFaucet) {
          setProgress(1);
          // Monto fijo: lo define el contrato, no esta pantalla.
          await token.faucet();
        } else if (moneda === "pen") {
          // Dos pasos simulados para que no se sienta instantáneo: "pago
          // confirmado" y luego "acreditado" son eventos distintos en
          // cualquier on-ramp real, aunque acá los dos sean el mismo
          // addFunds() de golpe.
          await new Promise((r) => setTimeout(r, 700));
          if (!alive) return;
          setProgress(1);
          await addFunds(value);
        } else {
          await addFunds(value);
        }
        if (alive) setStep("listo");
      } catch (err) {
        if (!alive) return;
        setError(
          err instanceof Error ? err.message : "No se pudo completar la operación",
        );
        setStep("monto");
      }
    })();

    return () => {
      alive = false;
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
                  {formatUsdc(canFaucet || canDeposit ? (token.balance ?? 0n) : balance)}{" "}
                  <span className="text-[13px] text-low">
                    {canFaucet || canDeposit ? token.symbol : "USDC"}
                  </span>
                </div>

                {error && (
                  <div
                    className="mt-4 rounded-[var(--r-panel)] border px-3 py-2.5 text-[12.5px]"
                    style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
                  >
                    {error}
                  </div>
                )}

                {canFaucet ? (
                  <>
                    <p className="mt-5 text-[13px] leading-relaxed text-mid">
                      El faucet de prueba entrega un monto fijo de {token.symbol} a tu
                      wallet. Es una transacción real en la red configurada.
                    </p>
                    <p className="mt-2 text-[12px] text-low">
                      {token.symbol} es un token de desarrollo, no el USDC de Circle.
                    </p>
                  </>
                ) : canDeposit ? (
                  <>
                    <p className="mt-5 text-[13px] leading-relaxed text-mid">
                      Esta red usa el USDC de Circle, que no tiene faucet. Envía
                      USDC a tu dirección desde otro wallet o un bridge; el saldo
                      se lee directo onchain.
                    </p>
                    <div className="mt-3 break-all rounded-[var(--r-input)] border border-border bg-surface px-3 py-2.5 num text-[12px] text-mid">
                      {session?.address}
                    </div>
                    <div
                      className="mt-3 flex items-start gap-2 rounded-[var(--r-panel)] border px-3 py-2 text-[12px]"
                      style={{ borderColor: "var(--warning)", color: "var(--warning)" }}
                    >
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Sin USDC en la wallet, las transacciones de inversión van a
                      revertir.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-5 flex gap-1.5 rounded-[var(--r-input)] border border-border bg-surface p-1">
                      {(
                        [
                          { key: "usdc" as const, label: "USDC directo" },
                          { key: "pen" as const, label: "Soles (Yape/Plin/Tarjeta)" },
                        ]
                      ).map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => {
                            setMoneda(opt.key);
                            setAmount(opt.key === "pen" ? "500" : "1000");
                          }}
                          className="flex-1 rounded-[calc(var(--r-input)-3px)] py-1.5 text-[11.5px] font-medium transition-colors"
                          style={{
                            backgroundColor:
                              moneda === opt.key ? "var(--brand)" : "transparent",
                            color:
                              moneda === opt.key ? "var(--brand-ink)" : "var(--text-mid)",
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <label className="mt-3 block">
                      <span className="text-[12.5px] font-medium text-hi">
                        {moneda === "pen" ? "Monto a pagar" : "Monto a agregar"}
                      </span>
                      <span className="mt-1.5 flex items-center gap-2 rounded-[var(--r-input)] border border-border bg-surface px-3 transition-colors focus-within:border-[var(--brand-ink)]">
                        <input
                          autoFocus
                          inputMode="decimal"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="num h-11 w-full bg-transparent text-[16px] text-hi outline-none"
                        />
                        <span className="text-[12.5px] text-low">
                          {moneda === "pen" ? "PEN" : "USDC"}
                        </span>
                      </span>
                      {moneda === "pen" && (
                        <span className="mt-1.5 block text-[11.5px] text-low">
                          ≈ {formatUsdc(value)} USDC · tipo de cambio simulado{" "}
                          {MOCK_PEN_PER_USD.toFixed(2)} PEN/USD
                        </span>
                      )}
                    </label>

                    <div className="mt-2.5 grid grid-cols-4 gap-2">
                      {(moneda === "pen" ? MONTOS_PEN : MONTOS).map((m) => (
                        <button
                          key={m}
                          onClick={() => setAmount(String(m))}
                          className="num rounded-[var(--r-input)] border border-border bg-surface py-1.5 text-[11.5px] text-mid transition-colors hover:border-[var(--brand-ink)] hover:text-[var(--brand-ink)]"
                        >
                          {moneda === "pen" ? formatPen(m) : m.toLocaleString("es-PE")}
                        </button>
                      ))}
                    </div>

                    {moneda === "pen" && (
                      <div className="mt-3">
                        <span className="text-[12.5px] font-medium text-hi">
                          Método de pago
                        </span>
                        <div className="mt-1.5 grid grid-cols-3 gap-2">
                          {METODOS.map((m) => (
                            <button
                              key={m.key}
                              onClick={() => setMetodo(m.key)}
                              className="rounded-[var(--r-input)] border py-2 text-[12px] font-medium transition-colors"
                              style={{
                                borderColor:
                                  metodo === m.key ? "var(--brand-ink)" : "var(--border)",
                                color:
                                  metodo === m.key ? "var(--brand-ink)" : "var(--text-mid)",
                              }}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div
                      className="mt-3 flex items-start gap-2 rounded-[var(--r-panel)] border px-3 py-2 text-[12px]"
                      style={{ borderColor: "var(--warning)", color: "var(--warning)" }}
                    >
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {moneda === "pen"
                        ? "Rampa simulada: no hay proveedor de pagos real conectado. El tipo de cambio es fijo y el saldo se acredita localmente."
                        : "Saldo de demostración: no hay contrato desplegado en esta red, así que este depósito no toca la cadena."}
                    </div>
                  </>
                )}

                <Button
                  className="mt-5 w-full"
                  size="lg"
                  disabled={!canFaucet && !canDeposit && parsed <= 0}
                  onClick={canDeposit ? onClose : () => setStep("procesando")}
                  iconRight={canDeposit ? undefined : <ArrowRight className="h-4 w-4" />}
                >
                  {canFaucet
                    ? `Recibir ${token.symbol} de prueba`
                    : canDeposit
                      ? "Listo"
                      : moneda === "pen"
                        ? `Pagar con ${metodoLabel}`
                        : "Confirmar"}
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
                  {pasos.map((label, i) => {
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
                  className="flex h-11 w-11 items-center justify-center rounded-full border"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--positive)" }}
                >
                  <Wallet className="h-5 w-5" style={{ color: "var(--positive)" }} />
                </motion.span>

                <div className="mt-3 text-[13px] text-mid">
                  {canFaucet ? "Saldo en tu wallet" : "Nuevo saldo"}
                </div>
                {canFaucet ? (
                  <div className="num text-[28px] font-bold text-hi">
                    {formatUsdc(token.balance ?? 0n)}
                    <span className="text-[14px] text-low"> {token.symbol}</span>
                  </div>
                ) : (
                  <AnimatedNumber
                    value={balance}
                    from={balanceBefore}
                    className="num text-[28px] font-bold text-hi"
                    suffix=" USDC"
                  />
                )}

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
