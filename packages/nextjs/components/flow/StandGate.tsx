"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Logo } from "@/components/ui/Logo";
import { Waiting } from "@/components/ui/Waiting";
import { shortHash } from "@/lib/format";
import { clearIntendedRole, setIntendedRole } from "@/lib/intendedRole";
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

  /**
   * Con quién volvemos: el correo si Privy lo tiene, y si no la wallet.
   *
   * Cuando esto existe junto con `yaEs`, la pantalla deja de ser una
   * elección. Mostrar la tarjeta del lado Y un "continuar como…" era
   * ofrecer dos controles para exactamente la misma acción: tocar
   * cualquiera de los dos reanudaba la misma sesión. Ya no se pregunta lo
   * que ya está respondido — se confirma quién entra.
   */
  const identidad = pendingAccount ?? (session ? shortHash(session.address, 6) : null);
  const vuelve = Boolean(yaEs && identidad);

  function choose(role: Role) {
    setChosen(role);
    setIntendedRole(role);
    connectWallet();
  }

  /** Entrar con la sesión que ya existe: la de siempre, sin código. */
  function volver() {
    setChosen(yaEs);
    if (pendingAccount) resumeSession();
    else connectWallet();
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

      {/* Dos columnas: la tesis a la izquierda, la decisión a la derecha.
          Apilado en una sola, el ojo bajaba por título, párrafo, tarjeta y
          dos renglones de enlaces mientras media pantalla quedaba vacía al
          costado. Con lo elegido ya sabido —una sola tarjeta— eso se veía
          peor todavía. En teléfono vuelve a ser una columna, que es donde
          apilar sí corresponde. */}
      <motion.div
        variants={stagger(0.07)}
        initial="hidden"
        animate="show"
        className="mx-auto grid w-full max-w-[620px] flex-1 grid-cols-1 items-center gap-8 py-7 sm:py-10 lg:max-w-[980px] lg:grid-cols-[1fr_minmax(380px,440px)] lg:gap-14"
      >
        <div>
          {/* El titular nombra el intercambio, porque el intercambio ES el
              negocio: entra capital, sale un proyecto financiado, y hay un
              retorno pactado de por medio.

              Decía "Crédito privado para empresas que ya facturan", y eso
              no es el negocio: es un **requisito para calificar**. Vive en
              la tarjeta del dueño de negocio, junto al resto de lo que se
              le va a pedir, no encima de todo. Puesto acá, la primera cosa
              que leía alguien que no sabe qué es crédito privado era una
              condición de algo que todavía no le habían dicho qué era —
              como abrir con la letra chica.

              El mecanismo (garantía y orden de pago en el contrato) se
              queda abajo, de apoyo. Diferencia, pero no explica: solo
              significa algo para quien ya entendió qué se está financiando. */}
          <motion.h1
            variants={fadeUp}
            className="h1 text-[26px] leading-[1.1] text-balance sm:text-[34px] lg:text-[42px]"
          >
            Capital para un proyecto concreto, con retorno pactado.
          </motion.h1>

          {/* Una línea, no un párrafo. Lo que cada travesía implica ya lo
              dice su propia tarjeta, y repetirlo acá era el texto de más
              que hacía scroll a la decisión. */}
          <motion.p
            variants={fadeUp}
            className="mt-3 max-w-[42ch] text-[14px] leading-relaxed text-mid sm:mt-4 sm:text-[15px]"
          >
            {vuelve
              ? `Vuelves como ${yaEs === "investor" ? "inversionista" : "dueño de negocio"}.`
              : "La garantía y el orden de pago se ejecutan en el contrato."}
          </motion.p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Quien vuelve no elige: entra. La tarjeta muestra CON QUÉ
              cuenta —que es el único dato que aún no está decidido— y el
              lado baja a ser un dato más de esa cuenta. */}
          {vuelve ? (
            <TravesiaCard
              title={identidad!}
              detail={
                yaEs === "investor"
                  ? "Sigues donde estabas: el catálogo y las operaciones que ya miraste."
                  : "Sigues donde estabas: tus expedientes y su estado de revisión."
              }
              aside={
                yaEs === "investor"
                  ? `${TOPUP_TOKEN_AMOUNT.toLocaleString("es-PE")} USDC de prueba en tu wallet.`
                  : "Tu expediente, donde lo dejaste."
              }
              busy={connecting}
              disabled={false}
              action="Entrar"
              onClick={volver}
            />
          ) : (
            <>
              <TravesiaCard
                title="Soy inversionista"
                detail="Pongo capital en una operación y sigo cómo se libera por hitos hasta el repago."
                aside={`Entras con ${TOPUP_TOKEN_AMOUNT.toLocaleString("es-PE")} USDC de prueba ya acreditados.`}
                busy={connecting && chosen === "investor"}
                disabled={connecting && chosen !== "investor"}
                onClick={() => choose("investor")}
              />
              <TravesiaCard
                title="Soy dueño de negocio"
                detail="Armo el expediente de mi empresa —ventas, garantía, proyecto— y lo envío a revisión."
                aside="Entras con un expediente por armar, no con saldo."
                busy={connecting && chosen === "business"}
                disabled={connecting && chosen !== "business"}
                onClick={() => choose("business")}
              />
            </>
          )}

          {/* La única salida que queda: este teléfono es de otra persona.
              Antes acá convivían dos enlaces, y uno de ellos hacía lo
              mismo que el botón de la tarjeta.

              Y presumía el lado contrario: `setIntendedRole(yaEs ===
              "investor" ? "business" : "investor")` le asignaba a la
              cuenta siguiente el opuesto de la anterior. Nadie había
              elegido eso. Quien entra con otra cuenta puede ser un
              inversionista más —dos personas del mismo lado compartiendo
              un teléfono en el stand es el caso normal, no el raro— y el
              rol no se puede cambiar después de fijado. Se limpia la
              intención y la puerta vuelve a preguntar, que es lo único
              que no puede salir mal. */}
          {vuelve && !connecting && (
            <motion.p variants={fadeUp} className="text-[12.5px] text-low">
              <button
                onClick={() => {
                  clearIntendedRole();
                  switchAccount();
                }}
                className="focusable underline decoration-dotted underline-offset-4 transition-colors hover:text-hi"
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
              className="text-[13px]"
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
        </div>
      </motion.div>
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
  action = "Entrar",
  onClick,
}: {
  title: string;
  detail: string;
  aside: string;
  busy: boolean;
  disabled: boolean;
  /** Palabra de la acción. Quien vuelve no elige un lado: entra. */
  action?: string;
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
      <span className="h2 w-full truncate text-[18px] sm:text-[20px]">{title}</span>
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
            {action}
          </span>
        )}
      </span>
    </motion.button>
  );
}
