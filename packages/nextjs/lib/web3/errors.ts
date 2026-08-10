/**
 * Traducir un error de cadena a algo que se pueda leer.
 *
 * wagmi y viem escriben para quien programa: mensajes en inglés, con la
 * dirección completa, el nombre interno del conector y un pie que dice
 * `Version: @wagmi/core@3.6.0`. Eso terminaba impreso tal cual dentro de
 * un cartel rojo del producto —"Account 0x91a0…AbA3 not found for
 * connector Privy Wallet"— como primera impresión de alguien que acababa
 * de registrarse.
 *
 * Los mensajes propios sí se muestran: son los que escribimos nosotros,
 * en castellano y con una salida. Lo que se filtra es lo demás.
 */

/** Marcas de que el texto viene de una librería y no de nosotros. */
const DE_LIBRERIA = [
  "Version: @",
  "not found for connector",
  "docs.viem.sh",
  "wagmi.sh",
  "ContractFunctionExecutionError",
  "TransactionExecutionError",
  "HttpRequestError",
  "Details:",
  "Request Arguments:",
];

/** Rechazos explícitos: no son fallas, son una decisión de la persona. */
const RECHAZO = [
  "User rejected",
  "user rejected",
  "denied transaction",
  "UserRejectedRequestError",
];

export function mensajeDeCadena(
  cause: unknown,
  respaldo = "No se pudo completar la operación onchain.",
): string {
  const crudo = cause instanceof Error ? cause.message : String(cause ?? "");
  if (!crudo.trim()) return respaldo;

  if (RECHAZO.some((m) => crudo.includes(m))) {
    return "Cancelaste la firma. Puedes intentarlo de nuevo cuando quieras.";
  }

  if (DE_LIBRERIA.some((m) => crudo.includes(m))) return respaldo;

  // Los nuestros son de una línea. Si vienen varias, es un volcado.
  const primera = crudo.split("\n")[0].trim();
  if (primera.length > 160) return respaldo;

  return primera;
}
