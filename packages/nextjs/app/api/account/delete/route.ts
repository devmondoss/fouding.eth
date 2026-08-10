import { NextResponse } from "next/server";
import { getAuthenticatedWallet, getPrivyServerClient } from "@/lib/privyServer";
import { bloqueoDeBorrado, purgarCuenta } from "@/lib/account/purge";

/**
 * Borra la cuenta: los datos primero, el usuario de Privy después.
 *
 * Antes solo hacía lo segundo. El usuario desaparecía de Privy y el
 * nombre y el documento declarados seguían en `access_applications`, la
 * empresa en `companies` y los expedientes con sus PDFs en la base — o
 * sea que "Eliminar cuenta" borraba la llave de entrada y dejaba dentro
 * todo lo que la persona quería que se fuera.
 *
 * El userId y la wallet salen del token verificado, nunca del body:
 * nadie puede pedir el borrado de otra cuenta.
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

  // La wallet sale del mismo token, no del body: es la que identifica
  // todo lo que esta cuenta dejó en la base.
  const wallet = await getAuthenticatedWallet(req);

  let purga = null;
  if (wallet) {
    // Se avisa ANTES de borrar nada. Descubrir a mitad del proceso que
    // una fila no se puede tocar dejaría la cuenta medio borrada: sin
    // expedientes pero con empresa, o sin usuario en Privy y con todos
    // los datos intactos.
    const bloqueo = await bloqueoDeBorrado(wallet).catch(() => null);
    if (bloqueo) {
      return NextResponse.json({ error: bloqueo.motivo }, { status: 409 });
    }

    // **Primero la base, después Privy.** Al revés, un fallo al purgar
    // dejaría a alguien sin forma de volver a entrar —el usuario ya no
    // existe— y con su nombre y su documento todavía guardados: el peor
    // de los dos resultados posibles, y el único irreparable desde la
    // aplicación.
    try {
      purga = await purgarCuenta(wallet);
    } catch (err) {
      console.error("[account] no se pudieron borrar los datos:", err);
      return NextResponse.json(
        { error: "No se pudieron borrar tus datos, intenta de nuevo" },
        { status: 500 },
      );
    }
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

  return NextResponse.json({ ok: true, purga });
}
