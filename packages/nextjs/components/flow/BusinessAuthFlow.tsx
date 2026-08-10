"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { ComoFunciona } from "@/components/flow/ComoFunciona";
import { Wordmark } from "@/components/ui/Logo";
import { Modal } from "@/components/ui/Modal";
import { Waiting } from "@/components/ui/Waiting";
import { useSession } from "@/lib/useSession";
import { fadeUp } from "@/lib/motion";

/**
 * Login del lado empresa — mismo useSession/Privy que AuthFlow (lado
 * inversionista), copiado en vez de compartido porque lo único que
 * cambia entre ambos es el copy: extraer un shell compartido para dos
 * consumidores es abstracción prematura (ver plan de agosto 2026).
 */

export function BusinessAuthFlow() {
  const {
    connectWallet,
    switchAccount,
    connecting,
    connectError,
    cancelConnect,
    pendingAccount,
    resumeSession,
  } = useSession();
  const [showTerms, setShowTerms] = useState(false);


  // Ver AuthFlow: los tres botones comparten `connectWallet` y la bandera
  // `connecting`, así que sin registrar la intención la espera decía
  // "Creando tu wallet" incluso al cambiar de cuenta — que es justo cuando
  // useSession está cerrando la sesión anterior, no creando nada.
  const [intent, setIntent] = useState<"connect" | "switch">("connect");

  // Ver AuthFlow: cambiar de cuenta va por `switchAccount`, no por
  // `connectWallet` — este último entra con la sesión viva y por lo tanto
  // devolvía la cuenta anterior sin pedir correo.
  function start(next: "connect" | "switch") {
    setIntent(next);
    if (next === "switch") switchAccount();
    else connectWallet();
  }

  return (
    <main
      className="flex min-h-screen flex-col px-5 py-6 sm:px-8 sm:py-8"
      style={{ backgroundColor: "var(--surface)" }}
    >
      {/* Esta pantalla no tenía marca en ningún lado: se llegaba desde un
          correo o un QR a un formulario que pedía el correo de tu empresa
          sin decir de quién era. La cabecera es la del resto del producto
          —marca a la izquierda, la salida a la derecha— y la salida acá es
          volver a la página que sí explica todo, que ya existe. */}
      <motion.header
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="flex shrink-0 items-center justify-between"
      >
        <Wordmark suffix="Empresas" />
        <Link
          href="/negocios"
          className="focusable flex h-9 items-center rounded-[var(--r-input)] px-2.5 text-[12.5px] text-mid transition-colors hover:bg-surface-soft hover:text-hi"
        >
          Cómo funciona
        </Link>
      </motion.header>

      <div className="mx-auto flex w-full max-w-[var(--w-doc)] flex-1 items-center py-8">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
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
                      disabled={connecting}
                    >
                      Continuar como {pendingAccount}
                    </Button>

                    <p className="mt-3 text-center text-[12.5px] text-mid">
                      <button
                        onClick={() => start("switch")}
                        disabled={connecting}
                        className="focusable -mx-1.5 inline-flex h-8 items-center px-1.5 font-medium underline decoration-dotted transition-colors hover:text-hi disabled:opacity-50"
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
                      loading={connecting}
                      onClick={() => start("connect")}
                    >
                      Iniciar sesión
                    </Button>

                    <p className="mt-3 text-center text-[12.5px] text-mid">
                      ¿No tienes cuenta?{" "}
                      <button
                        onClick={() => start("connect")}
                        disabled={connecting}
                        className="focusable -mx-1.5 inline-flex h-8 items-center px-1.5 font-medium underline decoration-dotted transition-colors hover:text-hi disabled:opacity-50"
                        style={{ color: "var(--brand-ink)" }}
                      >
                        Regístrate
                      </button>
                    </p>
                  </>
                )}

                {/* Ver AuthFlow: el modal de Privy ya es la pantalla, así
                    que no montamos otra detrás. Solo agregamos lo que Privy
                    no puede saber, y una salida. */}
                {connecting && !connectError && (
                  <div className="mt-4 rounded-[var(--r-panel)] border border-border px-3.5 py-3">
                    <Waiting label="Conectando" width={64} />
                    <div className="mt-2 text-[12px] leading-relaxed text-mid">
                      {intent === "switch"
                        ? "Cerrando tu sesión actual para pedirte el otro correo. La wallet de tu empresa no se toca."
                        : "Continúa en la ventana que se abrió."}
                      <button
                        onClick={cancelConnect}
                        className="focusable ml-1.5 font-medium underline decoration-dotted transition-colors hover:text-hi"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {connectError && (
                  <div
                    role="alert"
                    className="mt-4 rounded-[var(--r-panel)] border px-3.5 py-3"
                    style={{ borderColor: "var(--negative)" }}
                  >
                    <div
                      className="text-[12.5px] font-semibold"
                      style={{ color: "var(--negative)" }}
                    >
                      No se pudo conectar
                    </div>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-mid">
                      {connectError}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => connectWallet()}
                    >
                      Reintentar
                    </Button>
                  </div>
                )}

                <p className="mt-3 text-center text-[11.5px] text-low">
                  Al continuar aceptas los{" "}
                  <button
                    onClick={() => setShowTerms(true)}
                    className="focusable -mx-1.5 inline-flex h-8 items-center px-1.5 underline decoration-dotted transition-colors hover:text-hi"
                    style={{ color: "var(--text-mid)" }}
                  >
                    Términos y condiciones
                  </button>
                </p>

                {/* Acá vivía un segundo enlace a /negocios. Con la cabecera
                    puesta eran dos controles para exactamente la misma
                    acción, en la misma pantalla — el mismo defecto que ya
                    se corrigió una vez en la puerta del stand. La
                    explicación completa sigue estando a un toque, arriba a
                    la derecha, donde el producto pone siempre la salida. */}
              </div>

              {/* Eran tres frases sueltas: "sin contraseñas", "lo revisa
                  una persona", "la wallet recibe el desembolso". Ciertas
                  las tres, y ninguna ordenada — respondían objeciones, que
                  no es lo mismo que explicar el recorrido. Quien llega acá
                  no sabe qué pasa DESPUÉS de conectar, y esa es la
                  pregunta que lo tiene con el dedo encima del botón. Las
                  tres frases siguen estando: viven dentro del paso al que
                  pertenecen. */}
              <div
                className="flex flex-col justify-center sm:border-l sm:pl-14"
                style={{ borderColor: "var(--border-strong)" }}
              >
                <ComoFunciona pausado={connecting || Boolean(connectError)} />
              </div>
            </motion.div>
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
            Al conectar tu wallet aceptas que este es un entorno de
            pruebas y que la información mostrada es ilustrativa.
          </p>
        </div>
      </Modal>
    </main>
  );
}
