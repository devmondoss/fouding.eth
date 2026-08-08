"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Teclado del shell. Igual que con color y movimiento: los atajos no se
 * improvisan en el componente, salen de acá.
 *
 * El problema que resuelve: la aplicación es una sola pantalla con capas
 * encima (ficha, panel, modal). Si cada capa engancha su listener a `window`,
 * todas escuchan a la vez — Escape cierra el modal *y* la ficha que lo
 * contiene, y ← mueve el cursor dentro de un input mientras pagina el
 * catálogo que quedó detrás. Acá hay una pila: solo la capa de arriba actúa,
 * y la base solo actúa cuando no hay ninguna capa abierta.
 */

/** Un campo editable se queda con las flechas y con Escape. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("input, textarea, select, [contenteditable='true']") !== null
  );
}

/** Pila de capas abiertas, de la más profunda a la más superficial. */
const stack: object[] = [];

function pushLayer(token: object) {
  stack.push(token);
}

function popLayer(token: object) {
  const i = stack.lastIndexOf(token);
  if (i !== -1) stack.splice(i, 1);
}

function isTopLayer(token: object) {
  return stack.length > 0 && stack[stack.length - 1] === token;
}

/** Cuántas capas hay encima de la base. */
export function layersOpen(): number {
  return stack.length;
}

type LayerKeys = {
  /** Cerrar la capa. Se dispara solo si esta es la capa de arriba. */
  onEscape?: () => void;
  /** Paso o página anterior — ignorado dentro de un campo editable. */
  onPrev?: () => void;
  /** Paso o página siguiente — ignorado dentro de un campo editable. */
  onNext?: () => void;
  /** Falso mientras la capa está cerrada: no se registra ni escucha. */
  active?: boolean;
};

/**
 * Registra una capa y le da el teclado mientras esté arriba de la pila.
 * La usan ficha, paneles laterales y modales.
 */
export function useLayerKeys({
  onEscape,
  onPrev,
  onNext,
  active = true,
}: LayerKeys) {
  const token = useRef<object>({});
  // El ref se sincroniza en un efecto, no durante el render: el listener
  // vive fuera del ciclo de render y solo necesita la versión más reciente
  // cuando llega la tecla.
  const handlers = useRef({ onEscape, onPrev, onNext });
  useEffect(() => {
    handlers.current = { onEscape, onPrev, onNext };
  });

  useEffect(() => {
    if (!active) return;
    const mine = token.current;
    pushLayer(mine);
    return () => popLayer(mine);
  }, [active]);

  useEffect(() => {
    if (!active) return;

    const onKey = (e: KeyboardEvent) => {
      if (!isTopLayer(token.current)) return;
      const { onEscape: esc, onPrev: prev, onNext: next } = handlers.current;

      if (e.key === "Escape" && esc) {
        // Sin esto, un modal abierto sobre la ficha cierra los dos.
        e.stopPropagation();
        e.preventDefault();
        esc();
        return;
      }

      if (isTypingTarget(e.target)) return;

      if (e.key === "ArrowLeft" && prev) {
        e.preventDefault();
        prev();
      }
      if (e.key === "ArrowRight" && next) {
        e.preventDefault();
        next();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
}

/**
 * Teclado de la pantalla base (el catálogo). Solo actúa cuando no hay
 * ninguna capa abierta encima y el foco no está en un campo editable.
 */
export function useBaseKeys({
  onPrev,
  onNext,
}: {
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const handlers = useRef({ onPrev, onNext });
  useEffect(() => {
    handlers.current = { onPrev, onNext };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (layersOpen() > 0) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlers.current.onPrev?.();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        handlers.current.onNext?.();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/**
 * Foco de diálogo: lo lleva al panel al abrir, lo mantiene dentro mientras
 * está abierto, y lo devuelve al disparador al cerrar. Sin esto, tabular
 * desde una ficha abierta camina hacia el catálogo que quedó detrás.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  const focusables = useCallback(() => {
    const root = ref.current;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  }, []);

  useEffect(() => {
    if (!active) return;
    restoreTo.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const first = focusables()[0] ?? ref.current;
    first?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !ref.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const node = ref.current;
    node?.addEventListener("keydown", onKey);
    return () => {
      node?.removeEventListener("keydown", onKey);
      restoreTo.current?.focus({ preventScroll: true });
    };
  }, [active, focusables]);

  return ref;
}
