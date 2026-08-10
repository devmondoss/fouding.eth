import type { Transition, Variants } from "motion/react";

/**
 * Sistema de movimiento. Igual que con los colores: las animaciones no se
 * improvisan en el componente, salen de acá.
 *
 * Criterio: en una plataforma financiera el movimiento debe *orientar*, no
 * entretener. Duraciones cortas, una sola curva, y nada que rebote salvo la
 * confirmación de una acción del usuario.
 */

/** Curva única del sistema: salida rápida, entrada suave. */
export const EASE = [0.22, 0.9, 0.3, 1] as const;

export const DUR = {
  instant: 0.12,
  fast: 0.2,
  base: 0.28,
  slow: 0.4,
  /** Conteo de una cifra. Más largo que cualquier transición de UI porque
   *  acá el movimiento *cuenta algo* — es la única excepción. */
  count: 0.7,
} as const;

export const T = {
  fast: { duration: DUR.fast, ease: EASE },
  base: { duration: DUR.base, ease: EASE },
  slow: { duration: DUR.slow, ease: EASE },
  /** Solo para confirmaciones: un rebote mínimo que se siente táctil. */
  spring: { type: "spring", stiffness: 320, damping: 26, mass: 0.7 },
  /** Subrayados y píldoras que se desplazan entre pestañas. */
  indicator: { type: "spring", stiffness: 420, damping: 34 },
} satisfies Record<string, Transition>;

/** Aparición estándar de un bloque. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: T.base },
  exit: { opacity: 0, y: -8, transition: T.fast },
};

/** Contenedor que escalona la entrada de sus hijos. */
export const stagger = (delay = 0.04): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delay, delayChildren: 0.02 } },
});

/** Deslizamiento direccional, para pasos y páginas del carrusel. */
export const slide = (dir: number, distance = 34): Variants => ({
  hidden: { opacity: 0, x: dir * distance },
  show: { opacity: 1, x: 0, transition: T.base },
  exit: { opacity: 0, x: dir * -distance, transition: T.fast },
});

/** Capa modal que crece desde el centro. */
export const dialog: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 10 },
  show: { opacity: 1, scale: 1, y: 0, transition: T.base },
  exit: { opacity: 0, scale: 0.985, y: 6, transition: T.fast },
};

/** Velo de fondo. */
export const scrim: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: T.fast },
  exit: { opacity: 0, transition: T.fast },
};

/** Panel lateral. */
export const sheet: Variants = {
  hidden: { x: "100%" },
  show: { x: 0, transition: { duration: DUR.base, ease: EASE } },
  exit: { x: "100%", transition: { duration: DUR.fast, ease: EASE } },
};

/** Hoja que sube desde abajo. Es la forma que toma `dialog` en un
 *  teléfono: una capa que crece desde el centro no tiene de dónde crecer
 *  cuando ocupa el viewport entero, y el borde inferior es el único que
 *  la mano alcanza. Misma curva, mismo rol — otra dirección. */
/**
 * Hoja que sube desde el borde de abajo.
 *
 * El `opacity: 1` explícito NO es decorativo: sin él la ficha era
 * invisible en teléfono. `useEsHoja` arranca en false —en el servidor no
 * hay viewport—, así que el primer frame se pinta con las variantes de
 * `dialog`, que sí traen `opacity: 0` en `hidden`. Cuando el efecto
 * corrige a true y las variantes se cambian por estas, motion anima hacia
 * `show`… que no decía nada de la opacidad, así que el 0 heredado se
 * quedaba puesto: la hoja terminaba a tamaño completo, en su sitio y
 * completamente transparente.
 *
 * Regla: dos juegos de variantes intercambiables tienen que declarar las
 * MISMAS propiedades, o el que llega hereda lo que el otro dejó.
 */
export const sheetUp: Variants = {
  hidden: { y: "100%", opacity: 1, scale: 1 },
  show: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: DUR.base, ease: EASE },
  },
  exit: {
    y: "100%",
    opacity: 1,
    scale: 1,
    transition: { duration: DUR.fast, ease: EASE },
  },
};

/** Carta del deck en móvil: entra desde el lado por el que se deslizó.
 *  El eje es vertical porque el pulgar recorre la pila hacia arriba. */
export const card = (dir: number, distance = 40): Variants => ({
  hidden: { opacity: 0, y: dir * distance },
  show: { opacity: 1, y: 0, transition: T.base },
  exit: { opacity: 0, y: dir * -distance, transition: T.fast },
});

/** Respuesta táctil compartida por todo lo pulsable. */
export const press = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.985 },
  transition: T.fast,
} as const;
