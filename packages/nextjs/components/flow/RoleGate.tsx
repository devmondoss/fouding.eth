"use client";

import { motion } from "motion/react";
import { T } from "@/lib/motion";
import type { Role } from "@/lib/useSession";

/**
 * Fase obligatoria post-wallet: se muestra una sola vez por address
 * (mientras `session.role` sea null) y fija el rol para siempre — ver
 * useSession.chooseRole. Es la pieza que evita que un mismo wallet
 * navegue entre el lado inversionista y el lado empresa sin declarar
 * cuál es (ver conversación de arquitectura, agosto 2026).
 */
export function RoleGate({
  onChoose,
  onSignOut,
}: {
  onChoose: (role: Role) => void;
  /** Salida de emergencia. La elección es permanente por wallet, así que
   * quien llegó con la cuenta equivocada tiene que poder salir ANTES de
   * fijarla — si no, queda encerrado sin forma de deshacer. */
  onSignOut?: () => void;
}) {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8"
      style={{ backgroundColor: "var(--surface)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={T.base}
        className="w-full max-w-[640px]"
      >
        <h1 className="h1 text-center text-[26px] leading-[1.1] sm:text-[30px]">
          ¿Qué te trae por acá?
        </h1>
        <p className="mt-2 text-center text-[13.5px] text-mid">
          Esta wallet queda fija a lo que elijas.
        </p>

        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <RoleCard
            title="Soy inversionista"
            detail="Quiero invertir en crédito privado respaldado por garantía real."
            onClick={() => onChoose("investor")}
          />
          <RoleCard
            title="Soy dueño de negocio"
            detail="Quiero solicitar financiamiento para mi empresa."
            onClick={() => onChoose("business")}
          />
        </div>

        {onSignOut && (
          <p className="mt-6 text-center text-[12.5px] text-low">
            ¿Entraste con la cuenta equivocada?{" "}
            <button
              onClick={onSignOut}
              className="underline decoration-dotted transition-colors hover:text-hi"
              style={{ color: "var(--text-mid)" }}
            >
              Cerrar sesión
            </button>
          </p>
        )}
      </motion.div>
    </div>
  );
}

/**
 * Las dos tarjetas abrían con un chip chartreuse: una flecha ascendente
 * para el inversionista y un edificio para la empresa. Dos íconos de
 * librería encima de dos frases que ya empiezan por "Soy" — el sujeto lo
 * dice el titular. Y la flecha del "Continuar" tampoco hacía falta: la
 * tarjeta entera es el botón.
 */
function RoleCard({
  title,
  detail,
  onClick,
}: {
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="focusable card card-hover group flex flex-col items-start gap-2 p-5 text-left"
    >
      <span className="h3 text-[17px]">{title}</span>
      <span className="text-[13px] leading-relaxed text-mid">{detail}</span>
      <span
        className="mt-2 text-[12.5px] font-medium underline decoration-transparent underline-offset-4 transition-colors group-hover:decoration-current"
        style={{ color: "var(--brand-ink)" }}
      >
        Continuar
      </span>
    </button>
  );
}
