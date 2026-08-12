"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { shortHash } from "@/lib/format";
import { fadeUp, stagger } from "@/lib/motion";
import { useSession } from "@/lib/useSession";

/**
 * La puerta. Entra, y nada más.
 *
 * Durante un tramo esta pantalla preguntaba el lado —inversionista o
 * dueño de negocio— y creaba la wallet como consecuencia. La idea era
 * ahorrarse un paso en el stand, y lo que produjo fue el contrario: **la
 * misma pregunta en dos pantallas**. `/rol` existe justamente para eso y
 * es donde tiene sentido, porque ahí la wallet ya existe y la respuesta
 * se le puede fijar de una vez; acá había que guardarla en `localStorage`,
 * hacerla sobrevivir al modal de Privy, caducarla a los diez minutos y
 * detectar el choque cuando la cuenta que volvía pertenecía al otro lado.
 * Toda esa maquinaria era el precio de adelantar una pregunta un paso.
 *
 * Ahora: acá se entra, en `/rol` se elige. Una pregunta, una pantalla.
 *
 * Lo único que esta pantalla sí sabe es a quién está dejando pasar cuando
 * ya lo conoce — y entonces no pide un correo que ya tiene.
 */
export function StandGate() {
  const {
    session,
    connectWallet,
    switchAccount,
    knownRole,
    connecting,
    connectError,
    cancelConnect,
    pendingAccount,
    resumeSession,
  } = useSession();

  /**
   * Con quién volvemos: el correo si Privy lo tiene, y si no la wallet.
   * Sale de `pendingAccount`/`knownRole` y no de `session` porque durante
   * el "cerrar sesión" suave la sesión está oculta pero la wallet sigue
   * siendo la misma — es justo el momento en que esta pantalla aparece.
   */
  const identidad = pendingAccount ?? (session ? shortHash(session.address, 6) : null);
  const vuelve = Boolean(identidad);

  /** Entrar con la sesión que ya existe: la de siempre, sin código. */
  function volver() {
    if (pendingAccount) resumeSession();
    else connectWallet();
  }

  return (
    // `h-[100svh]` con scroll PROPIO, no `min-h`: el shell del inversionista
    // bloquea el scroll del body (body.app-shell) y esta pantalla se monta
    // dentro de él. En un teléfono bajo —o con el texto agrandado por
    // accesibilidad— sin esta válvula el pie queda debajo del borde y es
    // inalcanzable. Es la excepción honesta del sistema (§6), no el patrón.
    <main
      className="flex h-[100svh] flex-col overflow-y-auto px-5 py-6 sm:px-8 sm:py-10"
      style={{ backgroundColor: "var(--surface)" }}
    >
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <span className="flex items-center gap-2">
          <Logo size={30} />
          <span className="h2 text-[19px]">Árbitro</span>
        </span>
      </motion.div>

      <motion.div
        variants={stagger(0.07)}
        initial="hidden"
        animate="show"
        className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center py-7 sm:py-10"
      >
        {/* El titular abre por el final malo, y es a propósito.
         *
         * Decía "Capital para un proyecto concreto, con retorno pactado":
         * cierto, y también la descripción exacta de un préstamo bancario,
         * de un fondo de deuda privada y de cualquier plataforma de
         * crowdlending del mercado. Una promesa que el vecino puede copiar
         * palabra por palabra no está posicionando nada.
         *
         * Lo que nadie de ese grupo puede poner en su portada es esto: qué
         * pasa cuando la empresa NO paga. Ahí es donde el resto manda a leer
         * un PDF y a esperar a un abogado, y donde acá el orden en que cobra
         * cada uno está escrito en el contrato y se ejecuta solo. PRODUCT.md
         * §Principles lo dice sin rodeos —"el camino de default es tan
         * importante como el feliz; es el diferenciador y debe ser visible,
         * no una letra chica"—, y la letra más grande de la casa es esta.
         *
         * Abrir por el riesgo en vez de por el retorno además hace el trabajo
         * que el copy institucional tiene que hacer: quien mueve capital de
         * terceros desconfía de quien solo le muestra el escenario bueno. */}
        <motion.h1
          variants={fadeUp}
          className="h1 text-[26px] leading-[1.1] text-balance sm:text-[34px]"
        >
          {vuelve
            ? "Bienvenido de vuelta."
            : "Lo que pasa si la empresa no paga ya está escrito en el contrato."}
        </motion.h1>

        {/* El subtítulo sostiene el titular con los otros dos hechos, en el
            orden del dinero: qué se ejecuta solo, y dónde está el capital
            mientras tanto. La wallet se fue de acá — la dice el botón que
            está tres centímetros más abajo, y gastar el último renglón del
            argumento en un detalle de registro era enterrarlo. */}
        <motion.p
          variants={fadeUp}
          className="mt-3 max-w-[46ch] text-[14px] leading-relaxed text-mid sm:mt-4 sm:text-[15px]"
        >
          {vuelve
            ? `Entras como ${identidad}.`
            : "No en letra chica: el orden en que cobra cada uno lo ejecuta el contrato. Y mientras tanto el capital no está en la empresa — está retenido y sale por hitos verificados."}
        </motion.p>

        <motion.div variants={fadeUp} className="mt-7">
          <Button
            size="lg"
            className="w-full"
            loading={connecting}
            onClick={vuelve ? volver : connectWallet}
          >
            {vuelve ? "Entrar" : "Entrar con mi correo"}
          </Button>
        </motion.div>

        {/* La única salida que queda: este teléfono es de otra persona. */}
        {vuelve && !connecting && (
          <motion.p
            variants={fadeUp}
            className="mt-3 text-center text-[12.5px] text-low"
          >
            <button
              onClick={switchAccount}
              className="focusable -mx-1.5 inline-flex h-8 items-center px-1.5 underline decoration-dotted underline-offset-4 transition-colors hover:text-hi"
            >
              No soy yo — entrar con otra cuenta
            </button>
          </motion.p>
        )}

        {/* El error es lo único que merece protagonismo acá: es nuestro,
            no de quien está tocando la pantalla. */}
        {connectError && (
          <motion.p
            variants={fadeUp}
            role="alert"
            className="mt-4 text-[13px]"
            style={{ color: "var(--negative)" }}
          >
            {connectError}{" "}
            <button
              onClick={cancelConnect}
              className="focusable underline decoration-dotted underline-offset-4"
            >
              Volver a intentar
            </button>
          </motion.p>
        )}

        {/* Quien ya tiene lado no necesita enterarse de nada más, pero
            quien entra por primera vez sí: lo siguiente que va a ver es la
            pregunta, y llegar avisado a una decisión que no se puede
            deshacer no es lo mismo que chocársela. */}
        {!vuelve && !knownRole && (
          <motion.p
            variants={fadeUp}
            className="mt-6 text-[12.5px] leading-relaxed text-low"
          >
            Después te preguntamos si vienes a invertir o a pedir
            financiamiento. Esa elección queda fija a tu wallet.
          </motion.p>
        )}
      </motion.div>

      <motion.p
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="mx-auto w-full max-w-[520px] text-[11.5px] leading-relaxed text-low sm:text-[12px]"
      >
        Catálogo de demostración sobre Arbitrum de prueba. El saldo que se
        acredita no es dinero: es un token de pruebas sin valor.
      </motion.p>
    </main>
  );
}
