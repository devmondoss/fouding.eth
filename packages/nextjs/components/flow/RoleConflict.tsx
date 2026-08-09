"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { fadeUp, stagger } from "@/lib/motion";
import type { Role } from "@/lib/useSession";

const NOMBRE: Record<Role, string> = {
  investor: "inversionista",
  business: "dueño de negocio",
};

/**
 * Una cuenta pertenece a un solo lado, y cuando alguien intenta entrar
 * por el otro se lo decimos.
 *
 * El rol se fija la primera vez que una wallet entra y no cambia (ver
 * `chooseRole`). Hasta acá eso se hacía cumplir, pero **en silencio**:
 * quien elegía "Soy dueño de negocio" con una cuenta ya registrada como
 * inversionista aterrizaba en el catálogo del inversionista sin una
 * palabra. La regla se respetaba y la persona quedaba convencida de que
 * la aplicación se había equivocado.
 *
 * Un redirect no es una respuesta. Esta pantalla dice tres cosas y nada
 * más: qué es esta cuenta, que eso no se cambia, y cuáles son las dos
 * salidas reales — seguir con el lado que le corresponde, o entrar con
 * otra cuenta.
 *
 * No lleva "Volver": la puerta ya está cerrada y volver a ella
 * ofrecería, otra vez, una elección que ya está tomada.
 */
export function RoleConflict({
  pedido,
  real,
  onContinuar,
  onOtraCuenta,
}: {
  /** El lado que la persona acaba de pedir. */
  pedido: Role;
  /** El lado al que la wallet pertenece de verdad. */
  real: Role;
  onContinuar: () => void;
  onOtraCuenta: () => void;
}) {
  return (
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
        className="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center py-8"
      >
        <motion.h1
          variants={fadeUp}
          className="h1 text-[26px] leading-[1.1] text-balance sm:text-[32px]"
        >
          Esta cuenta ya es de {NOMBRE[real]}.
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mt-3 max-w-[52ch] text-[14px] leading-relaxed text-mid sm:text-[15px]"
        >
          Pediste entrar como {NOMBRE[pedido]}, pero esta cuenta quedó
          registrada como {NOMBRE[real]} la primera vez que entró y eso no se
          cambia. Una cuenta pertenece a un solo lado.
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="mt-8 flex flex-col items-start gap-4"
        >
          <Button size="lg" onClick={onContinuar}>
            Continuar como {NOMBRE[real]}
          </Button>

          <button
            onClick={onOtraCuenta}
            className="focusable text-[12.5px] text-low underline decoration-dotted underline-offset-4 transition-colors hover:text-hi"
          >
            Entrar con otra cuenta
          </button>
        </motion.div>
      </motion.div>
    </main>
  );
}
