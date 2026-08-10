/**
 * Comparar una operación contra el catálogo.
 *
 * Una tasa sola no dice nada. "13.9% fija a 12 meses" es un dato cierto y
 * financieramente inútil: no se sabe si es cara o barata hasta que se la
 * pone al lado de otra cosa. Lo mismo con una cobertura de 1.53x.
 *
 * El punto de comparación son las demás operaciones publicadas del mismo
 * grado de riesgo — dato propio, medible y verificable en la misma
 * pantalla, a diferencia de una tasa de referencia externa que habría que
 * inventar o citar sin fuente (PRODUCT.md §Evidence).
 *
 * Comparar contra TODO el catálogo sería peor que no comparar: una A al
 * 13.9% parece cara al lado de una E al 21%, cuando lo que las separa es
 * el riesgo, no el precio. Por eso el grado es la cohorte por defecto y
 * solo se ensancha cuando ese grado tiene muy pocas operaciones — y
 * cuando se ensancha, se dice.
 */

import { coverageBps } from "./opportunity";
import { computeScore } from "./underwriting";
import type { Grade, Opportunity } from "./types";

/** Debajo de esto una mediana es una anécdota, no una referencia. */
const MUESTRA_MINIMA = 6;

export type Comparativa = {
  /** Operaciones comparadas, sin contar esta. */
  muestra: number;
  /** Contra qué se comparó. La pantalla tiene que poder decirlo. */
  base: "grado" | "catalogo";
  grado: Grade;
  apyMedianaBps: number;
  coberturaMedianaBps: number;
  /** Diferencia de esta operación contra la mediana, en bps. Positivo =
   *  paga más / cubre más que la mitad de sus comparables. */
  apyDeltaBps: number;
  coberturaDeltaBps: number;
};

function mediana(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/**
 * `null` cuando no hay con qué comparar. La pantalla entonces no compara,
 * que es honesto; inventar una referencia para llenar el hueco no lo es.
 */
export function compararConElCatalogo(
  o: Opportunity,
  catalogo: Opportunity[],
): Comparativa | null {
  const grado = computeScore(o).grade;

  // Solo operaciones que ya pasaron por underwriting y no son esta. Las
  // que están en revisión todavía no tienen precio que comparar.
  const publicadas = catalogo.filter(
    (x) => x.slug !== o.slug && x.status !== "review",
  );

  const delGrado = publicadas.filter((x) => computeScore(x).grade === grado);
  const usarGrado = delGrado.length >= MUESTRA_MINIMA;
  const cohorte = usarGrado ? delGrado : publicadas;

  if (cohorte.length < MUESTRA_MINIMA) return null;

  const apyMedianaBps = mediana(cohorte.map((x) => x.apyBps));
  const coberturaMedianaBps = mediana(cohorte.map(coverageBps));

  return {
    muestra: cohorte.length,
    base: usarGrado ? "grado" : "catalogo",
    grado,
    apyMedianaBps,
    coberturaMedianaBps,
    apyDeltaBps: o.apyBps - apyMedianaBps,
    coberturaDeltaBps: coverageBps(o) - coberturaMedianaBps,
  };
}
