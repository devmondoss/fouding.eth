import { NextResponse } from "next/server";

/**
 * Auth mínima para las rutas del verificador: una API key compartida
 * por header `Authorization: Bearer <key>`. No es un sistema de roles
 * de verdad — es el mínimo indispensable para que estas rutas no queden
 * abiertas a cualquiera mientras no hay IdentityRegistry ni Supabase.
 * Reemplazar por auth real (wallet del verificador + su stake, ver
 * conceptos-y-cambios.md §Verificador) cuando el contrato exista.
 */
export function requireVerifierAuth(req: Request): NextResponse | null {
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

  return null;
}
