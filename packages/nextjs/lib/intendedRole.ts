import type { Role } from "./useSession";

/**
 * El rol elegido ANTES de que exista la wallet.
 *
 * En el stand la primera pantalla no es "conectate", es "¿inversionista o
 * dueño de negocio?" — la persona elige su travesía y recién ahí Privy
 * crea la wallet. Entre esas dos cosas hay un modal de un tercero y, si
 * la pestaña se recarga, un viaje de ida y vuelta completo: la elección
 * tiene que sobrevivir eso o la persona vuelve a una puerta que ya abrió.
 *
 * Vive en `localStorage` y no en estado de React por ese motivo. Se
 * consume una sola vez: en cuanto `chooseRole` lo fija en la sesión, se
 * borra. No es la fuente de verdad del rol —esa es `founding.role` por
 * dirección, que no cambia nunca— sino el pasamanos entre la puerta y la
 * wallet.
 */

const KEY = "founding.intendedRole";

export function setIntendedRole(role: Role) {
  try {
    window.localStorage.setItem(KEY, role);
  } catch {}
}

export function readIntendedRole(): Role | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw === "investor" || raw === "business" ? raw : null;
  } catch {
    return null;
  }
}

export function clearIntendedRole() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}
