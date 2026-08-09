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
 * consume una sola vez: en cuanto se aplica, se borra. No es la fuente de
 * verdad del rol —esa es `founding.role` por dirección, que no cambia
 * nunca— sino el pasamanos entre la puerta y la wallet.
 *
 * **Caduca a propósito.** Una intención sin caducidad es una trampa en un
 * stand: alguien toca "Soy dueño de negocio", abandona el modal de Privy
 * y se va; media hora después otra persona entra en el mismo teléfono,
 * crea su wallet y se la marca como empresa sin haber elegido nada. El
 * pasamanos solo vale para el viaje que lo originó.
 */

const KEY = "founding.intendedRole";

/** Lo que dura un viaje de ida y vuelta por el modal de Privy, con
 *  margen para escribir un correo y buscar el código en el mail. Más allá
 *  de esto, la elección ya no es de quien está tocando la pantalla. */
const VIGENCIA_MS = 10 * 60 * 1000;

type Guardado = { role: Role; at: number };

export function setIntendedRole(role: Role) {
  try {
    const dato: Guardado = { role, at: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(dato));
  } catch {}
}

export function readIntendedRole(): Role | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;

    const dato = JSON.parse(raw) as Partial<Guardado>;
    if (dato.role !== "investor" && dato.role !== "business") return null;
    if (typeof dato.at !== "number" || Date.now() - dato.at > VIGENCIA_MS) {
      clearIntendedRole();
      return null;
    }
    return dato.role;
  } catch {
    // Formato viejo (el valor era el rol pelado) o almacenamiento roto:
    // se descarta. Perder una intención cuesta una pregunta de más;
    // aplicar una que no se entiende cuesta un rol mal asignado, y el rol
    // no se puede cambiar después.
    clearIntendedRole();
    return null;
  }
}

export function clearIntendedRole() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}
