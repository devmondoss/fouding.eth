import { NextResponse } from "next/server";
import { getPrivyServerClient } from "@/lib/privyServer";

/**
 * Borra la cuenta del usuario autenticado en Privy — de verdad, no solo
 * datos locales. El userId a borrar sale del token verificado, nunca
 * del body: nadie puede pedir el borrado de otra cuenta.
 */
export async function POST(req: Request) {
  const client = getPrivyServerClient();
  if (!client) {
    return NextResponse.json(
      { error: "Borrado de cuenta no disponible en este entorno (falta PRIVY_APP_SECRET)" },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Falta el token de sesión" }, { status: 401 });
  }

  let userId: string;
  try {
    const claims = await client.verifyAuthToken(token);
    userId = claims.userId;
  } catch {
    return NextResponse.json({ error: "Sesión inválida o expirada" }, { status: 401 });
  }

  try {
    await client.deleteUser(userId);
  } catch (err) {
    console.error("[account] error al eliminar usuario en Privy:", err);
    return NextResponse.json(
      { error: "No se pudo eliminar la cuenta, intenta de nuevo" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
