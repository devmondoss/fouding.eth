"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useSession } from "@/lib/useSession";
import { T } from "@/lib/motion";

/**
 * Login del lado empresa — mismo useSession/Privy que AuthFlow (lado
 * inversionista), copiado en vez de compartido porque lo único que
 * cambia entre ambos es el copy: extraer un shell compartido para dos
 * consumidores es abstracción prematura (ver plan de agosto 2026).
 */

export function BusinessAuthFlow() {
  const {
    connectWallet,
    connecting,
    connectError,
    cancelConnect,
    pendingAccount,
    resumeSession,
  } = useSession();
  const [showTerms, setShowTerms] = useState(false);
  const step = connecting || connectError ? "connecting" : "intro";

  return (
    <div
      className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8"
      style={{ backgroundColor: "var(--surface)" }}
    >
      <div className="w-full max-w-[860px]">
        <AnimatePresence mode="wait">
          {/* --------------------------------------------------- INTRO */}
          {step === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={T.base}
              className="grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-14"
            >
              <div className="max-w-[400px]">
                <h1 className="h1 text-[28px] leading-[1.1] sm:text-[34px] sm:leading-[1.05]">
                  Conecta tu empresa
                </h1>

                <p className="mt-3 text-[14px] leading-relaxed text-mid">
                  Crea tu cuenta con tu correo — te generamos una wallet al
                  instante. Es la que va a quedar habilitada para recibir el
                  capital si tu expediente es aprobado.
                </p>

                {/* Ver AuthFlow: reanudar sin código y entrar con otra
                    cuenta son dos salidas distintas y ambas deben verse. */}
                {pendingAccount ? (
                  <>
                    <Button
                      size="lg"
                      className="mt-7 w-full"
                      onClick={resumeSession}
                      iconRight={<ArrowRight className="h-4 w-4" />}
                    >
                      Continuar como {pendingAccount}
                    </Button>

                    <p className="mt-3 text-center text-[12.5px] text-mid">
                      <button
                        onClick={() => connectWallet()}
                        className="font-medium underline decoration-dotted transition-colors hover:text-hi"
                        style={{ color: "var(--brand-ink)" }}
                      >
                        Entrar con otro correo
                      </button>
                    </p>
                  </>
                ) : (
                  <>
                    <Button
                      size="lg"
                      className="mt-7 w-full"
                      onClick={() => connectWallet()}
                      iconRight={<ArrowRight className="h-4 w-4" />}
                    >
                      Iniciar sesión
                    </Button>

                    <p className="mt-3 text-center text-[12.5px] text-mid">
                      ¿No tienes cuenta?{" "}
                      <button
                        onClick={() => connectWallet()}
                        className="font-medium underline decoration-dotted transition-colors hover:text-hi"
                        style={{ color: "var(--brand-ink)" }}
                      >
                        Regístrate
                      </button>
                    </p>
                  </>
                )}

                <p className="mt-3 text-center text-[11.5px] text-low">
                  Al continuar aceptas los{" "}
                  <button
                    onClick={() => setShowTerms(true)}
                    className="underline decoration-dotted transition-colors hover:text-hi"
                    style={{ color: "var(--text-mid)" }}
                  >
                    Términos y condiciones
                  </button>
                </p>

                {/* La explicación completa vive en /negocios, con URL propia:
                    se visita cuando hace falta, no se atraviesa cada vez. */}
                <p className="mt-5 text-center text-[12.5px] text-mid">
                  <Link
                    href="/negocios"
                    className="underline decoration-dotted transition-colors hover:text-hi"
                  >
                    ¿Cómo funciona Founding para empresas?
                  </Link>
                </p>
              </div>

              <div className="flex flex-col justify-center gap-4 sm:border-l sm:pl-14" style={{ borderColor: "var(--border-strong)" }}>
                {[
                  "Sin contraseñas ni frase semilla que perder",
                  "Tu expediente lo revisa una persona, no un bot",
                  "La wallet que conectas es la que recibe el desembolso",
                ].map((t) => (
                  <div
                    key={t}
                    className="flex items-start gap-2.5 text-[13.5px] text-mid"
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0"
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
              className="mx-auto max-w-[400px]"
            >
              <h1 className="h1 text-[30px]">
                {connectError ? "No se pudo conectar" : "Creando tu wallet"}
              </h1>
              <p className="mt-2 text-[14px] text-mid">
                {connectError
                  ? connectError
                  : "Ingresa tu correo en la ventana que aparece."}
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

              {connectError ? (
                <Button
                  variant="outline"
                  className="mt-6 w-full"
                  onClick={() => connectWallet()}
                >
                  Reintentar
                </Button>
              ) : (
                <button
                  onClick={cancelConnect}
                  className="mt-6 text-[12.5px] text-mid transition-colors hover:text-hi"
                >
                  Cancelar
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Modal
        open={showTerms}
        onClose={() => setShowTerms(false)}
        title="Términos y condiciones"
        subtitle="Prototipo — no constituye asesoría de inversión"
        width={520}
        footer={<Button onClick={() => setShowTerms(false)}>Entendido</Button>}
      >
        <div className="flex flex-col gap-3.5 text-[12.5px] leading-relaxed text-mid">
          <p>
            Founding es un <strong>prototipo</strong>. Opera sobre Arbitrum
            Sepolia (testnet) con USDC de prueba — nada de lo que veas acá
            mueve dinero real todavía.
          </p>
          <p>
            Tu wallet es non-custodial: la creamos con Privy usando tu
            correo, pero las claves no están en nuestro poder ni podemos
            revertir ninguna operación en tu nombre.
          </p>
          <p>
            La verificación de identidad, la evaluación crediticia y la
            aprobación de expedientes en esta versión son procesos
            simulados con fines de demostración, no un proceso de KYC/KYB
            regulado.
          </p>
          <p>
            Al conectar tu wallet aceptás que este es un entorno de
            pruebas y que la información mostrada es ilustrativa.
          </p>
        </div>
      </Modal>
    </div>
  );
}
