"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/lib/useSession";
import { T } from "@/lib/motion";

/**
 * Entrada al producto: Privy crea/conecta la wallet embebida al
 * instante — modal en la misma página, sin extensión ni registro. En
 * cuanto `session` deja de ser null, page.tsx deja de renderizar este
 * componente y entra directo a la app: no hay una pantalla de "confirmar
 * entrada" que agregar acá, sería fricción sin motivo (ver conversación
 * de arquitectura, agosto 2026).
 */

export function AuthFlow() {
  const { connectWallet, connecting, connectError, cancelConnect } = useSession();
  // Derivado, no estado propio: "connecting" cubre tanto el spinner como
  // el error (se queda ahí hasta reintentar o cancelar); cualquier otra
  // combinación es "intro". Cancelar limpia ambos flags y por eso vuelve
  // solo al inicio, sin necesitar un efecto que lo empuje.
  const step = connecting || connectError ? "connecting" : "intro";

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
                Arbitrum. Te creamos una wallet al instante con tu correo:
                sin contraseñas, sin frase semilla.
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
                  onClick={connectWallet}
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
    </div>
  );
}
