"use client";

import { useEffect, useState } from "react";

/**
 * Si la capa que se abre encima tiene que comportarse como hoja (teléfono
 * y tablet) o como diálogo (escritorio).
 *
 * Existe porque hay una decisión que CSS no puede tomar sola: la variante
 * de movimiento. Todo lo demás del salto entre tamaños se resuelve con
 * clases —`lg:` gobierna forma, alto y bordes— pero `dialog` y `sheetUp`
 * son dos objetos de JavaScript y hay que elegir uno antes de renderizar.
 *
 * El corte es el mismo `lg` de Tailwind que usa el resto del producto: un
 * segundo umbral, escrito a mano, es como se desincronizan la forma y el
 * gesto.
 *
 * Arranca en `false` a propósito. En el servidor no hay viewport, así que
 * cualquier suposición es una apuesta; la apuesta segura es el diálogo,
 * porque si se equivoca solo cambia la dirección de una entrada de 0,28s
 * en el primer frame, y no el tamaño de nada.
 */
const HOJA = "(max-width: 1023.98px)";

export function useEsHoja(): boolean {
  const [esHoja, setEsHoja] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(HOJA);
    setEsHoja(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setEsHoja(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return esHoja;
}
