import { NextResponse } from "next/server";
import { clientIp, isRateLimited } from "./rateLimit";

/**
 * Auth mínima para las rutas del verificador: una API key compartida
 * por header `Authorization: Bearer <key>`. No es un sistema de roles
 * de verdad — es el mínimo indispensable para que estas rutas no queden
 * abiertas a cualquiera mientras no hay IdentityRegistry ni Supabase.
 * Reemplazar por auth real (wallet del verificador + su stake, ver
 * conceptos-y-cambios.md §Verificador) cuando el contrato exista.
 *
 * Como la key es una sola y la comparten todos los clientes, limitar
 * por key no serviría de nada — el rate limit va por IP (ver
 * rateLimit.ts), después de validar la key.
 */
export async function requireVerifierAuth(
  req: Request,
): Promise<NextResponse | null> {
  const expected = process.env.VERIFIER_API_KEY;
  if (!expected) {
    // Sin la env var configurada, no hay forma segura de validar nada —
    // fallar cerrado, no abierto.
    return NextResponse.json(
      { error: "Backend del verificador sin configurar (falta VERIFIER_API_KEY)" },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token !== expected) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    if (await isRateLimited(clientIp(req))) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes, intenta de nuevo en un minuto" },
        { status: 429 },
      );
    }
  } catch (err) {
    console.error("[verifier] error de base de datos (rate limit):", err);
    return NextResponse.json(
      { error: "El servicio no está disponible en este momento, intenta de nuevo" },
      { status: 503 },
    );
  }

  return null;
}
