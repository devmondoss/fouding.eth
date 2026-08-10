import type { Role } from "./useSession";

/**
 * El mapa de rutas del producto, en un solo sitio.
 *
 * Cada superficie tiene nombre y ninguna vive en la raíz — `/` no pinta
 * nada, solo reparte (ver app/page.tsx). La regla que sostiene esto es
 * que la barra de direcciones debe describir lo que la pantalla está
 * haciendo, y por eso existen `/rol`, `/solicitar/nueva` y compañía.
 *
 *   /login          la puerta: el único login, de los dos lados
 *   /rol            elegir lado, una vez por wallet
 *   /oportunidades  catálogo del inversionista
 *   /solicitar      panel de empresa
 *   /negocios       página pública de venta
 *
 * Esto vivía dentro de `components/flow/RoleGateScreen.tsx`, o sea que
 * tres archivos de ruta importaban una función de decisión desde un
 * módulo que además renderiza una pantalla completa. Además de estar en
 * el sitio equivocado, arrastraba todo ese componente —y sus imports— a
 * quien solo quería saber a dónde mandar a alguien, que es justo la
 * forma de terminar con un ciclo de módulos y un `homeFor is not
 * defined` en tiempo de ejecución.
 */

export const RUTAS = {
  puerta: "/login",
  elegirRol: "/rol",
  inversionista: "/oportunidades",
  empresa: "/solicitar",
} as const;

/** A dónde vive cada rol una vez elegido. */
export function homeFor(role: Role): string {
  return role === "business" ? RUTAS.empresa : RUTAS.inversionista;
}
