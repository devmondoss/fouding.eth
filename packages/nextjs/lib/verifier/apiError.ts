import { NextResponse } from "next/server";

/**
 * Si Neon está caído o el query falla, sin esto la ruta revienta con
 * un 500 sin cuerpo (o cuelga) — el cliente no tiene forma de
 * distinguir eso de un bug real. Envuelve la parte de la ruta que toca
 * la base de datos para devolver siempre un JSON legible.
 */
export async function withDbErrors(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    console.error("[verifier] error de base de datos:", err);
    return NextResponse.json(
      { error: "El servicio no está disponible en este momento, intenta de nuevo" },
      { status: 503 },
    );
  }
}
