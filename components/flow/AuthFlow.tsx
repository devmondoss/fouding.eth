"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, Check, Copy, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/useSession";
import { T } from "@/lib/motion";

/**
 * Entrada al producto: Coinbase Smart Wallet vía passkey (huella/Face
 * ID) — no una wallet generada por nosotros, y tampoco requiere ninguna
 * extensión instalada de antemano. La verificación de identidad no está
 * acá — se mueve al momento de invertir, que es donde la regulación la
 * exige de verdad.
 */

type Step = "intro" | "connecting" | "ready";

export function AuthFlow({ onDone }: { onDone: () => void }) {
  const { session, connectWallet, connecting, connectError } = useSession();
  const [step, setStep] = useState<Step>("intro");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (connecting) setStep("connecting");
  }, [connecting]);

  useEffect(() => {
    if (session) setStep("ready");
  }, [session]);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8"
      style={{ backgroundColor: "var(--surface)" }}
    >
      <div className="w-full max-w-[400px]">
        <AnimatePresence mode="wait">
          {/* --------------------------------------------------- INTRO */}
          {step === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={T.base}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...T.spring, delay: 0.05 }}
                className="flex items-center gap-2.5"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-[8px] text-[17px] font-bold"
                  style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
                >
                  ✳
                </span>
                <span className="h2 text-[22px]">Founding</span>
              </motion.div>

              <h1 className="h1 mt-9 text-[28px] leading-[1.1] sm:text-[34px] sm:leading-[1.05]">
                Invierte en empresas
                <br />
                que ya facturan
              </h1>

              <p className="mt-3 text-[14px] leading-relaxed text-mid">
                Crédito privado respaldado por garantía real, en USDC sobre
                Arbitrum. Te creamos una wallet al instante con tu huella o
                Face ID: sin registro, sin contraseñas, sin frase semilla.
              </p>

              <Button
                size="lg"
                className="mt-7 w-full"
                onClick={connectWallet}
                iconRight={<ArrowRight className="h-4 w-4" />}
              >
                Crear mi wallet y entrar
              </Button>

              <div className="mt-6 flex flex-col gap-2.5">
                {[
                  "No pedimos datos personales para explorar",
                  "Ticket mínimo de 1,000 USDC por operación",
                  "Cada operación muestra su garantía y su cobertura",
                ].map((t) => (
                  <div
                    key={t}
                    className="flex items-start gap-2 text-[12.5px] text-mid"
                  >
                    <Check
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      style={{ color: "var(--positive)" }}
                    />
                    {t}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* --------------------------------------------- CONECTANDO */}
          {step === "connecting" && (
            <motion.div
              key="connecting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={T.fast}
            >
              <h1 className="h1 text-[30px]">
                {connectError ? "No se pudo conectar" : "Creando tu wallet"}
              </h1>
              <p className="mt-2 text-[14px] text-mid">
                {connectError
                  ? connectError
                  : "Confirma con tu huella o Face ID cuando el navegador lo pida."}
              </p>

              <div className="mt-8 flex items-center gap-3">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full border"
                  style={{
                    borderColor: connectError ? "var(--negative)" : "var(--brand-ink)",
                  }}
                >
                  {connectError ? (
                    <AlertTriangle className="h-3 w-3" style={{ color: "var(--negative)" }} />
                  ) : (
                    <Loader2
                      className="h-3 w-3 animate-spin"
                      style={{ color: "var(--brand-ink)" }}
                    />
                  )}
                </span>
                <span className="text-[14px] text-hi">
                  {connectError ? "Conexión rechazada o fallida" : "Esperando confirmación"}
                </span>
              </div>

              {connectError && (
                <Button
                  variant="outline"
                  className="mt-6 w-full"
                  onClick={connectWallet}
                >
                  Reintentar
                </Button>
              )}
            </motion.div>
          )}

          {/* --------------------------------------------------- LISTO */}
          {step === "ready" && session && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={T.base}
            >
              <motion.span
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...T.spring, delay: 0.05 }}
                className="flex h-12 w-12 items-center justify-center rounded-full border"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--positive)",
                }}
              >
                <Check
                  className="h-6 w-6"
                  style={{ color: "var(--positive)" }}
                  strokeWidth={2.5}
                />
              </motion.span>

              <h1 className="h1 mt-6 text-[30px]">Wallet conectada</h1>
              <p className="mt-2 text-[14px] leading-relaxed text-mid">
                Operas sobre Arbitrum con tu propia wallet. No custodiamos
                nada de tu lado.
              </p>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...T.base, delay: 0.12 }}
                className="mt-6 rounded-[var(--r-panel)] border border-border px-4 py-3.5"
                style={{ backgroundColor: "var(--surface-soft)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="label">Tu dirección</span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(session.address);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1600);
                    }}
                    className="flex items-center gap-1 text-[11.5px] text-mid transition-colors hover:text-hi"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3" /> Copiada
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copiar
                      </>
                    )}
                  </button>
                </div>
                <div className="num mt-1.5 break-all text-[13px] text-hi">
                  {session.address}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ ...T.base, delay: 0.2 }}
                className="mt-4 flex items-start gap-2 rounded-[var(--r-panel)] border px-3.5 py-3"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--brand-ink)",
                }}
              >
                <ShieldCheck
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  style={{ color: "var(--brand-ink)" }}
                />
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--brand-ink)" }}>
                  Puedes explorar el mercado libremente. La verificación de
                  identidad se solicita al momento de invertir.
                </p>
              </motion.div>

              <Button
                size="lg"
                className="mt-5 w-full"
                onClick={onDone}
                iconRight={<ArrowRight className="h-4 w-4" />}
              >
                Entrar al mercado
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
