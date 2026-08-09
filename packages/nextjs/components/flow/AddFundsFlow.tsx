"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Address } from "viem";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Button } from "@/components/ui/Button";
import { Waiting } from "@/components/ui/Waiting";
import { useProtocolToken } from "@/hooks/useProtocolToken";
import { useAutoTopUp } from "@/hooks/useAutoTopUp";
import { useSaldo } from "@/hooks/useSaldo";
import { TOPUP_TOKEN_AMOUNT } from "@/lib/faucet/config";
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
 *   recarga      MockUSDC desplegado en la red configurada (devnet o
 *                Arbitrum Sepolia): la dispensadora del servidor manda
 *                gas y token a la wallet. Es gratis y no se firma nada,
 *                porque una wallet recién creada no tiene con qué firmar.
 *   depósito     la dispensadora no está disponible (sin llave, sin gas o
 *                sin fondos): queda mostrar la dirección para depositar
 *                desde otra wallet, con el motivo dicho.
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
  // Misma fuente que la barra superior y el panel de inversión: la cifra
  // no puede depender de qué pantalla la muestra.
  const saldo = useSaldo();
  // `auto: false`: el goteo automático ya lo hace SaldoDePrueba al
  // entrar. Acá solo se pide el estado y se ofrece el botón.
  const topUp = useAutoTopUp({ auto: false });

  const onChain = Boolean(token.address && session?.address);
  const canTopUp = onChain && token.faucetCapable && topUp.status?.available !== false;
  const canDeposit = onChain && !canTopUp;

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
  const pasos = canTopUp
    ? ["Enviando gas a tu wallet", "Acreditando el token de prueba"]
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
        if (canTopUp) {
          // El servidor manda gas y token: acá no se firma nada, porque
          // una wallet vacía no puede firmar. El monto lo fija
          // lib/faucet/config.ts, no esta pantalla.
          setProgress(1);
          const dripped = await topUp.topUp();
          if (!dripped) throw new Error(topUp.error ?? "No se pudo recargar");
          // Quien acreditó fue el servidor: sin releer, esta pantalla y la
          // barra se quedan mostrando el saldo viejo.
          await saldo.refetch?.();
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
              className="focusable -mr-1 flex h-7 items-center rounded-[var(--r-input)] px-1.5 text-[12px] text-mid transition-colors hover:bg-surface-soft hover:text-hi"
            >
              Cerrar
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
                  {formatUsdc(saldo.value)}{" "}
                  <span className="text-[13px] text-low">{saldo.symbol}</span>
                </div>

                {error && (
                  <div
                    className="mt-4 rounded-[var(--r-panel)] border px-3 py-2.5 text-[12.5px]"
                    style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
                  >
                    {error}
                  </div>
                )}

                {/* Los tres modos tenían dos párrafos cada uno explicando qué
                    es un faucet, qué es un bridge y qué token es cuál. Queda
                    la línea que cambia lo que la persona hace después. */}
                {canTopUp ? (
                  <>
                    <p className="mt-5 text-[13px] leading-relaxed text-mid">
                      Recibe {TOPUP_TOKEN_AMOUNT.toLocaleString("es-PE")}{" "}
                      {token.symbol} y el gas para operar, sin costo. Es un token
                      de prueba en Arbitrum Sepolia, no el USDC de Circle.
                    </p>
                    {topUp.status?.balance && (
                      <p className="num mt-2 text-[11.5px] text-low">
                        Gas disponible: {Number(topUp.status.balance.eth).toFixed(4)} ETH
                      </p>
                    )}
                  </>
                ) : canDeposit ? (
                  <>
                    <p className="mt-5 text-[13px] leading-relaxed text-mid">
                      {topUp.status?.reason ??
                        "La recarga automática no está disponible"}
                      . Mientras tanto, envía {token.symbol} a esta dirección desde
                      otra wallet.
                    </p>
                    <div className="num mt-3 break-all rounded-[var(--r-input)] border border-border bg-surface px-3 py-2.5 text-[12px] text-mid">
                      {session?.address}
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
                      className="mt-3 rounded-[var(--r-panel)] border px-3 py-2 text-[12px]"
                      style={{ borderColor: "var(--warning)", color: "var(--warning)" }}
                    >
                      {moneda === "pen"
                        ? "Rampa simulada: ningún proveedor de pagos real está conectado."
                        : "Saldo de demostración: este depósito no toca la cadena."}
                    </div>
                  </>
                )}

                <Button
                  className="mt-5 w-full"
                  size="lg"
                  disabled={!canTopUp && !canDeposit && parsed <= 0}
                  onClick={canDeposit ? onClose : () => setStep("procesando")}
                >
                  {canTopUp
                    ? `Recibir ${TOPUP_TOKEN_AMOUNT.toLocaleString("es-PE")} ${token.symbol}`
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
                {/* Cada paso era un círculo de 24px con un check o un spinner
                    dentro. Ahora el estado lo dice la palabra: el paso en
                    curso lleva la regla que barre, el terminado dice
                    "listo". Nada depende del glifo ni del color solos. */}
                <div className="flex flex-col gap-4">
                  {pasos.map((label, i) => {
                    const done = i < progress;
                    const active = i === progress;
                    return (
                      <div key={label} className="flex flex-col gap-1.5">
                        <span
                          className="text-[13.5px]"
                          style={{
                            color: done || active ? "var(--text-hi)" : "var(--text-low)",
                            fontWeight: active ? 600 : 400,
                          }}
                        >
                          {label}
                        </span>
                        {active && <Waiting label={label} width={96} />}
                        {done && (
                          <span
                            className="text-[11.5px] font-medium"
                            style={{ color: "var(--positive)" }}
                          >
                            listo
                          </span>
                        )}
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
                {/* La billetera dentro de un círculo verde no agregaba nada
                    que la cifra no diga. El spring entra con el número. */}
                <div className="text-[13px] text-mid">
                  {canTopUp ? "Saldo en tu wallet" : "Nuevo saldo"}
                </div>
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ ...T.spring, delay: 0.05 }}
                  className="mt-0.5"
                >
                  {canTopUp ? (
                    // El saldo sale de lo que devolvió la dispensadora, no de
                    // la lectura de wagmi: el receipt ya confirmó, pero el
                    // hook todavía puede estar sirviendo el valor viejo.
                    <div className="num text-[30px] font-bold text-hi">
                      {(topUp.result?.balance.token ?? Number(saldo.value / 1_000_000n)).toLocaleString("es-PE")}
                      <span className="text-[14px] text-low"> {saldo.symbol}</span>
                    </div>
                  ) : (
                    <AnimatedNumber
                      value={balance}
                      from={balanceBefore}
                      className="num text-[30px] font-bold text-hi"
                      suffix=" USDC"
                    />
                  )}
                </motion.div>

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
