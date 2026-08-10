"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Waiting } from "@/components/ui/Waiting";
import { useSession } from "@/lib/useSession";
import { fadeUp, T } from "@/lib/motion";

/**
 * Entrada al producto: Privy crea/conecta la wallet embebida al
 * instante — modal en la misma página, sin extensión ni registro. En
 * cuanto `session` deja de ser null, page.tsx deja de renderizar este
 * componente y entra directo a la app: no hay una pantalla de "confirmar
 * entrada" que agregar acá, sería fricción sin motivo (ver conversación
 * de arquitectura, agosto 2026).
 */

export function AuthFlow() {
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

  /**
   * Antes acá había un segundo paso a pantalla completa ("Creando tu
   * wallet" + spinner) que reemplazaba esta pantalla mientras Privy
   * conectaba. Estaba mal por dos motivos:
   *
   * 1. **El modal de Privy YA es la pantalla.** Dice "Log in or sign up" y
   *    pide el correo. Montarle detrás otra pantalla que dice lo mismo es
   *    duplicar la interfaz — y lo que se ve es un texto a medio tapar
   *    detrás del modal.
   * 2. **Tapaba el producto.** El orden de prelación desaparecía justo
   *    cuando la persona tiene medio minuto muerto mirando la pantalla
   *    mientras escribe su correo.
   *
   * Ahora la pantalla no se mueve: el botón entra en carga, y debajo
   * aparece una línea que dice qué está pasando. Lo único que sigue
   * mereciendo protagonismo es el error, porque eso sí es nuestro.
   */
  const [intent, setIntent] = useState<"connect" | "switch">("connect");

  /**
   * Las dos intenciones NO son la misma llamada. `connectWallet` entra con
   * la sesión que ya hay y, si está viva, no hace nada — que es lo
   * correcto para "iniciar sesión" y lo peor posible para "entrar con
   * otro correo": el botón se tocaba y volvía la cuenta anterior, sin
   * modal y sin campo de correo. Matar el token es exactamente lo que
   * distingue a `switchAccount`.
   */
  function start(next: "connect" | "switch") {
    setIntent(next);
    if (next === "switch") switchAccount();
    else connectWallet();
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8"
      style={{ backgroundColor: "var(--surface)" }}
    >
      <div className="w-full max-w-[var(--w-wide)]">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-16"
        >
          <div>
                <h1 className="h1 text-[28px] leading-[1.1] sm:text-[34px] sm:leading-[1.05]">
                  El orden de pago está
                  <br />
                  escrito antes de invertir
                </h1>

                <p className="mt-3 text-[14px] leading-relaxed text-mid">
                  Crédito privado a empresas peruanas que ya facturan,
                  respaldado por garantía real y en USDC sobre Arbitrum. El
                  capital queda retenido en el contrato, no en la empresa, y
                  se libera por hitos verificados.
                </p>

                {/* Con una sesión viva detrás de un "cerrar sesión" reciente
                    se puede reanudar sin correo ni código; con otra cuenta,
                    en cambio, hay que matar el token. Las dos salidas tienen
                    que estar visibles: ofrecer solo la primera fue el bug de
                    no poder cambiar de cuenta nunca. */}
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

            {/* Mientras el modal de Privy está abierto no hace falta
                repetir lo que ya dice. Lo único que agregamos es lo que
                Privy no puede saber: que al cambiar de cuenta la wallet
                anterior no se pierde. Y una salida, por si el modal se
                cierra sin resolver. */}
            {connecting && !connectError && (
              <div className="mt-4 rounded-[var(--r-panel)] border border-border px-3.5 py-3">
                <Waiting label="Conectando" width={64} />
                <div className="mt-2 text-[12px] leading-relaxed text-mid">
                  {intent === "switch"
                    ? "Cerrando tu sesión actual para pedirte el otro correo. Tu wallet anterior sigue existiendo."
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
                {/* El triángulo de advertencia junto a "No se pudo conectar"
                    en rojo era el tercer canal diciendo lo mismo: borde,
                    color y glifo. Bastan los dos primeros y la frase. */}
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
          </div>

          <PaymentOrderPreview />
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
            Las oportunidades de crédito privado que se muestran conllevan
            riesgo de pérdida total o parcial del capital invertido —
            incluido en escenarios de default, donde el recupero depende
            de la ejecución de la garantía y puede ser parcial. Nada acá
            constituye una recomendación ni garantía de rentabilidad.
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

/* ------------------------------------------------------------------------
   El primer viewport era un login con el 60% de la pantalla vacía: titular,
   botón y tres checks al otro lado de una línea. No se veía nada del
   producto, y es lo único que un jurado tiene garantizado ver.

   Acá va la tesis en vez de los checks: el orden de prelación, en la misma
   gramática que usa WaterfallPanel dentro de la ficha — los tramos del
   inversionista marcados con borde de tinta y la palabra literal, no con
   color. Sin cifras: el orden es un hecho estructural del contrato, mientras
   que cualquier monto acá sería un dato inventado (ver PRODUCT.md,
   §Evidence on Hand).
   ------------------------------------------------------------------------ */

/* Cuatro escalones, dos palabras cada uno. La versión anterior tenía
   título + subtítulo por tramo y dos párrafos alrededor: unas 90 palabras
   de vocabulario de prospecto. Era correcta y nadie la leía — saturaba en
   vez de explicar. Acá el mecanismo lo lleva la forma (una escalera que
   baja) y el texto solo nombra los peldaños. */
const ORDEN_DE_PAGO = [
  { label: "Costos de liquidación", mine: false },
  { label: "Servicing", mine: false },
  { label: "Tu capital", mine: true },
  { label: "Tus intereses", mine: true },
];

function PaymentOrderPreview() {
  return (
    <section className="card p-6 sm:p-7">
      <h2 className="h2 text-[17px]">Si la empresa no paga</h2>
      <p className="mt-1.5 text-[13px] text-mid">
        El contrato reparte lo recuperado en este orden.
      </p>

      {/* La escalera es el argumento: cada peldaño cobra antes que el
          siguiente. Sin cifras a propósito — el contrato garantiza el
          orden, y cualquier monto acá sería un dato inventado. */}
      <ol className="mt-6 flex flex-col gap-1.5">
        {ORDEN_DE_PAGO.map((t, i) => (
          <motion.li
            key={t.label}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...T.base, delay: 0.15 + i * 0.09 }}
            style={{ paddingLeft: i * 26 }}
          >
            <div
              className="flex items-center gap-3 rounded-[var(--r-panel)] border px-4 py-3"
              style={{
                borderColor: t.mine ? "var(--brand-ink)" : "var(--border)",
                borderWidth: t.mine ? 1.5 : 1,
                backgroundColor: t.mine
                  ? "var(--surface)"
                  : "var(--surface-soft)",
              }}
            >
              <span
                className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold"
                style={{
                  backgroundColor: t.mine
                    ? "var(--brand)"
                    : "var(--surface)",
                  color: t.mine ? "var(--brand-ink)" : "var(--text-low)",
                  border: t.mine ? "none" : "1px solid var(--border-strong)",
                }}
              >
                {i + 1}
              </span>
              <span
                className="text-[14px] font-semibold"
                style={{ color: t.mine ? "var(--text-hi)" : "var(--text-mid)" }}
              >
                {t.label}
              </span>
            </div>
          </motion.li>
        ))}
      </ol>

      <p className="mt-6 border-t border-border pt-4 text-[12px] leading-relaxed text-mid">
        Garantiza el orden, no el monto: el recupero de una garantía es
        parcial más veces de lo que es total.
      </p>
    </section>
  );
}
