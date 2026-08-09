"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Waiting } from "@/components/ui/Waiting";
import { useAutoTopUp } from "@/hooks/useAutoTopUp";
import { usePlatform } from "@/lib/data/store";
import { usdc } from "@/lib/format";
import { T } from "@/lib/motion";

/**
 * La acreditación del saldo de prueba, sin detener a nadie.
 *
 * Antes era una pantalla completa delante del catálogo: mientras la red
 * confirmaba, no se podía hacer absolutamente nada, y cuando la firma se
 * colgó eso significó una hora mirando una regla que barría. El trabajo
 * de esta franja es el mismo —decir que el saldo está en camino y avisar
 * cuando llega— pero desde abajo, con el producto ya usable detrás.
 *
 * No inventa la cifra. Se pensó pintar el saldo de forma optimista y
 * corregirlo al confirmar, pero el panel de inversión lee el saldo
 * ONCHAIN (`token.balance ?? balance`, InvestPanel), así que un número
 * adelantado en la barra terminaba en "saldo insuficiente" al intentar
 * invertir: la cifra aparece cuando existe de verdad.
 */
export function SaldoDePrueba() {
  const { phase, status, result, error, topUp } = useAutoTopUp();
  const { balance, addFunds } = usePlatform();
  const [cerrado, setCerrado] = useState(false);
  const sincronizando = useRef(false);

  const acreditado = result?.balance.token ?? null;

  // El saldo real vive en la cadena; el portafolio proyecta el suyo en
  // localStorage (lib/data/store.tsx). Si no se igualan, la barra
  // superior dice cero con la wallet llena.
  useEffect(() => {
    if (acreditado === null || sincronizando.current) return;
    sincronizando.current = true;
    const faltante = usdc(acreditado) - balance;
    if (faltante > 0n) addFunds(faltante).catch(() => {});
  }, [acreditado, balance, addFunds]);

  // El éxito se retira solo: ya explicó de dónde salió la cifra que
  // apareció en la barra. El fallo se queda, porque condiciona lo que la
  // persona va a poder hacer después.
  useEffect(() => {
    if (phase !== "done") return;
    const timer = setTimeout(() => setCerrado(true), 5000);
    return () => clearTimeout(timer);
  }, [phase]);

  const visible =
    !cerrado &&
    (phase === "loading" ||
      phase === "error" ||
      (phase === "done" && Boolean(result?.granted.token || result?.granted.gas)));

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={T.base}
          className="fixed bottom-4 left-1/2 z-[55] w-[min(440px,calc(100vw-24px))] -translate-x-1/2 rounded-[var(--r-card)] border bg-surface px-4 py-3 shadow-[var(--shadow-lg)]"
          style={{
            borderColor: phase === "error" ? "var(--negative)" : "var(--border)",
          }}
        >
          {phase === "loading" && (
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-hi">
                  Acreditando tu saldo de prueba
                </div>
                <div className="mt-0.5 text-[11.5px] text-low">
                  Puedes mirar el catálogo mientras tanto
                </div>
              </div>
              <Waiting label="Acreditando tu saldo" width={72} />
            </div>
          )}

          {phase === "done" && result && (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-hi">
                  {result.message}
                </div>
                <div className="mt-0.5 text-[11.5px] text-low">
                  Token de prueba sin valor, en Arbitrum Sepolia
                </div>
              </div>
              <button
                onClick={() => setCerrado(true)}
                className="focusable shrink-0 text-[12px] text-mid transition-colors hover:text-hi"
              >
                Cerrar
              </button>
            </div>
          )}

          {phase === "error" && (
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div
                  className="text-[13px] font-medium"
                  style={{ color: "var(--negative)" }}
                >
                  No pudimos acreditarte saldo de prueba
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-mid">
                  {puntuar(error ?? status?.reason ?? "La dispensadora no respondió")}{" "}
                  Explorar el catálogo no depende de esto.
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <button
                  onClick={() => topUp()}
                  className="focusable text-[12px] font-medium underline decoration-dotted"
                  style={{ color: "var(--brand-ink)" }}
                >
                  Reintentar
                </button>
                <button
                  onClick={() => setCerrado(true)}
                  className="focusable text-[12px] text-mid transition-colors hover:text-hi"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Los motivos de la dispensadora no traen punto final; el punto lo pone
 * quien compone la oración (ver lib/faucet/dispenser.ts). */
function puntuar(texto: string) {
  return /[.!?]$/.test(texto.trim()) ? texto : `${texto.trim()}.`;
}
