"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import { T } from "@/lib/motion";

/**
 * Un botón es su palabra. No acepta ícono —ni a la izquierda ni a la
 * derecha— porque la etiqueta ya tiene que completar el concepto sola: si
 * hace falta un glifo para entender "Aprobar", el problema es la palabra.
 * Ver docs/design-system.md §5.1.
 *
 * La espera tampoco es un ícono girando: la etiqueta se queda quieta y una
 * regla de 1.5px barre el borde inferior. El botón nunca cambia de tamaño
 * ni de texto al pasar a ocupado, así que no salta el layout de la fila.
 */

const VARIANT = {
  primary:
    "border border-transparent shadow-[var(--shadow-sm)] hover:brightness-110",
  outline:
    "bg-surface text-hi border border-border hover:border-border-strong hover:bg-surface-soft",
  soft: "bg-surface border hover:bg-surface-soft",
  ghost:
    "text-mid border border-transparent hover:bg-[rgba(16,24,40,0.04)] hover:text-hi",
  danger: "text-white border border-transparent hover:brightness-110",
} as const;

const SIZE = {
  sm: "h-8 px-3 text-[12.5px]",
  md: "h-10 px-4 text-[13.5px]",
  lg: "h-11 px-5 text-[14px]",
} as const;

const BG: Partial<Record<keyof typeof VARIANT, string>> = {
  primary: "var(--brand)",
  danger: "var(--negative)",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  disabled,
  ...rest
}: {
  children?: ReactNode;
  variant?: keyof typeof VARIANT;
  size?: keyof typeof SIZE;
  loading?: boolean;
} & HTMLMotionProps<"button">) {
  const inert = disabled || loading;

  return (
    <motion.button
      {...rest}
      disabled={inert}
      aria-busy={loading || undefined}
      whileHover={inert ? undefined : { y: -1 }}
      whileTap={inert ? undefined : { scale: 0.97 }}
      transition={T.fast}
      style={{
        backgroundColor: BG[variant],
        borderColor: variant === "soft" ? "var(--brand-ink)" : undefined,
        color:
          variant === "primary" || variant === "soft"
            ? "var(--brand-ink)"
            : undefined,
      }}
      className={[
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--r-input)] font-medium",
        "transition-colors duration-150",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-ink)]",
        VARIANT[variant],
        SIZE[size],
        inert ? "cursor-not-allowed" : "",
        // La opacidad de inhabilitado no se aplica mientras carga: un botón
        // ocupado sigue siendo el foco de la acción, no un control apagado.
        disabled && !loading ? "opacity-45" : "",
        loading ? "working" : "",
        className,
      ].join(" ")}
    >
      {children}
    </motion.button>
  );
}
