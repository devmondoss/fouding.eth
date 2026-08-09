"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Logo } from "@/components/ui/Logo";
import { Waiting } from "@/components/ui/Waiting";
import { setIntendedRole } from "@/lib/intendedRole";
import { fadeUp, press, stagger, T } from "@/lib/motion";
import { useSession, type Role } from "@/lib/useSession";
import { TOPUP_TOKEN_AMOUNT } from "@/lib/faucet/config";

/**
 * Primer contacto. Reemplaza a la pantalla de conexión en la raíz.
 *
 * Antes el orden era: conectar wallet → elegir rol (`/rol`). Ese orden
 * sirve cuando alguien llega por su cuenta a un producto que ya conoce,
 * y falla en un stand: la primera pantalla pedía una wallet a alguien
 * que todavía no sabe qué es esto ni qué va a hacer acá.
 *
 * Ahora la primera pantalla es la pregunta —¿inversionista o dueño de
 * negocio?— y la wallet se crea como consecuencia de haber elegido. La
 * elección viaja en `localStorage` porque entre el toque y la sesión hay
 * un modal de Privy y, si la pestaña se recarga, un viaje completo (ver
 * lib/intendedRole.ts).
 *
 * Las dos opciones no son simétricas y no se disimula: el inversionista
 * entra con saldo acreditado, el dueño de negocio entra con un expediente
 * por armar. Esa asimetría *es* la diferencia entre las dos travesías, y
 * decirla acá evita que la segunda pantalla sea una sorpresa.
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
  const [chosen, setChosen] = useState<Role | null>(null);

  /**
   * El lado que esta wallet ya tiene fijado. Una wallet pertenece a uno
   * solo y eso no cambia (ver `chooseRole`), así que cuando lo sabemos la
   * puerta NO pregunta: ofrecer dos caminos de los cuales uno está
   * cerrado es hacer elegir para después corregir. Se muestra el que es.
   *
   * Sale de `knownRole` y no de `session.role` porque durante el "cerrar
   * sesión" suave la sesión está oculta pero la wallet sigue siendo la
   * misma — es justo el momento en que esta pantalla aparece.
   */
  const yaEs = session?.role ?? knownRole;

  function choose(role: Role) {
    setChosen(role);
    setIntendedRole(role);
    connectWallet();
  }

  return (
    // `h-[100svh]` con scroll PROPIO, no `min-h`: el shell del inversionista
    // bloquea el scroll del body (body.app-shell) y esta pantalla se monta
    // dentro de él. En un teléfono de 640px de alto —o con el texto
    // agrandado por accesibilidad— el titular y las dos tarjetas no entran,
    // y sin esta válvula la segunda opción queda debajo del borde y es
    // inalcanzable. Es la excepción honesta del sistema (§6), no el patrón.
    <main
      className="flex h-[100svh] flex-col overflow-y-auto px-5 py-6 sm:px-8 sm:py-10"
      style={{ backgroundColor: "var(--surface)" }}
    >
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <span className="flex items-center gap-2">
          <Logo size={30} />
          <span className="h2 text-[19px]">Founding</span>
        </span>
      </motion.div>

      <motion.div
        variants={stagger(0.07)}
        initial="hidden"
        animate="show"
        className="mx-auto flex w-full max-w-[620px] flex-1 flex-col justify-center py-7 sm:py-10 lg:max-w-[860px]"
      >
        {/* El titular medía seis líneas en un teléfono de 640px de alto y
            empujaba la segunda opción debajo del borde: en la pantalla
            cuyo único trabajo es elegir entre dos caminos, uno de los dos
            no se veía. La tesis completa —garantía y orden de pago en el
            contrato— bajó a la línea de apoyo, que es donde cabe sin
            costarle la mitad de la pantalla a la decisión. */}
        <motion.h1
          variants={fadeUp}
          className="h1 text-[26px] leading-[1.1] text-balance sm:text-[34px] lg:text-[42px]"
        >
          Crédito privado para empresas que ya facturan.
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mt-3 max-w-[52ch] text-[14px] leading-relaxed text-mid sm:mt-4 sm:text-[15px]"
        >
          {yaEs
            ? "La garantía y el orden de pago se ejecutan en el contrato. Tu wallet ya está de este lado: sigue por donde ibas."
            : "La garantía y el orden de pago se ejecutan en el contrato. Elige desde qué lado quieres recorrerlo: tu wallet se crea al elegir y queda fija a ese lado."}
        </motion.p>

        {/* Una tarjeta o dos, según lo que esta wallet pueda elegir de
            verdad. Mostrar las dos y rechazar una al tocarla es pedir una
            decisión ya tomada para después corregirla. */}
        <div
          className={`mt-6 grid grid-cols-1 gap-3 sm:mt-9 lg:gap-4 ${
            yaEs ? "lg:max-w-[420px]" : "lg:grid-cols-2"
          }`}
        >
          {yaEs !== "business" && (
          <TravesiaCard
            title="Soy inversionista"
            detail="Pongo capital en una operación y sigo cómo se libera por hitos hasta el repago."
            aside={`Entras con ${TOPUP_TOKEN_AMOUNT.toLocaleString("es-PE")} USDC de prueba ya acreditados.`}
            busy={connecting && chosen === "investor"}
            disabled={connecting && chosen !== "investor"}
            onClick={() => choose("investor")}
          />
          )}
          {yaEs !== "investor" && (
            <TravesiaCard
              title="Soy dueño de negocio"
              detail="Armo el expediente de mi empresa —ventas, garantía, proyecto— y lo envío a revisión."
              aside="Entras con un expediente por armar, no con saldo."
              busy={connecting && chosen === "business"}
              disabled={connecting && chosen !== "business"}
              onClick={() => choose("business")}
            />
          )}
        </div>

        {/* La otra travesía no desaparece del mundo: cambia de cuenta. En
            un stand el mismo teléfono pasa de mano en mano, y quien viene
            a ver el otro lado necesita saber por dónde. */}
        {yaEs && !connecting && (
          <motion.p variants={fadeUp} className="mt-5 text-[13px] text-mid">
            ¿Vienes a recorrer el otro lado?{" "}
            <button
              onClick={() => {
                setIntendedRole(yaEs === "investor" ? "business" : "investor");
                switchAccount();
              }}
              className="focusable font-medium underline decoration-dotted underline-offset-4"
              style={{ color: "var(--brand-ink)" }}
            >
              Entrar con otra cuenta
            </button>
          </motion.p>
        )}

        {/* El error es lo único que merece protagonismo acá: es nuestro,
            no de quien está tocando la pantalla. */}
        {connectError && (
          <motion.p
            variants={fadeUp}
            role="alert"
            className="mt-5 text-[13px]"
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


        {/* Quien ya entró hoy y cerró sesión hace poco no debería volver a
            escribir un correo para seguir donde estaba. */}
        {pendingAccount && !connecting && (
          <motion.p variants={fadeUp} className="mt-5 text-[13px] text-mid">
            Tu sesión de {pendingAccount} sigue disponible.{" "}
            <button
              onClick={resumeSession}
              className="focusable font-medium underline decoration-dotted underline-offset-4"
              style={{ color: "var(--brand-ink)" }}
            >
              Continuar sin código
            </button>
          </motion.p>
        )}
      </motion.div>

      <motion.p
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="mx-auto w-full max-w-[620px] text-[11.5px] leading-relaxed text-low sm:text-[12px] lg:max-w-[860px]"
      >
        Catálogo de demostración sobre Arbitrum de prueba. El saldo que se
        acredita no es dinero: es un token de pruebas sin valor.
      </motion.p>
    </main>
  );
}

/**
 * Objetivo grande a propósito. En un stand esto se toca de pie, con una
 * mano, y muchas veces con el teléfono en la otra: el área pulsable es la
 * tarjeta entera y no un enlace de 13px dentro de ella.
 */
function TravesiaCard({
  title,
  detail,
  aside,
  busy,
  disabled,
  onClick,
}: {
  title: string;
  detail: string;
  aside: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      variants={fadeUp}
      {...press}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      transition={T.fast}
      className="focusable card card-hover group flex min-h-[118px] flex-col items-start gap-1.5 p-4 text-left disabled:opacity-45 sm:min-h-[150px] sm:gap-2 sm:p-6"
    >
      <span className="h2 text-[18px] sm:text-[20px]">{title}</span>
      <span className="text-[13.5px] leading-relaxed text-mid">{detail}</span>

      <span className="mt-auto flex w-full items-center justify-between gap-3 pt-3">
        <span className="text-[12px] leading-snug text-low">{aside}</span>
        {busy ? (
          <Waiting label="Creando tu wallet" width={44} />
        ) : (
          <span
            className="shrink-0 text-[12.5px] font-semibold underline decoration-transparent underline-offset-4 transition-colors group-hover:decoration-current"
            style={{ color: "var(--brand-ink)" }}
          >
            Entrar
          </span>
        )}
      </span>
    </motion.button>
  );
}
