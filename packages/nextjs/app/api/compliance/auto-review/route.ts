import { NextResponse } from "next/server";
import type { Address } from "viem";
import { getAuthenticatedWallet } from "@/lib/privyServer";
import { requirePublicRateLimit } from "@/lib/verifier/auth";
import { decideAccess, getAccessStatus } from "@/lib/compliance/onchain";

/**
 * Revisión automática del acceso de inversionista.
 *
 * El circuito manual existe y está completo —`/verifier`, pestaña "Acceso
 * de inversionistas", que aprueba o rechaza y firma la decisión onchain—
 * pero depende de que haya una persona del equipo sentada ahí. En un
 * stand eso corta la travesía del inversionista en el peor momento
 * posible: la persona entró, recibió saldo, eligió una operación, pulsó
 * invertir y ahí se queda esperando a alguien que quizá está atendiendo a
 * otro visitante.
 *
 * Es la misma decisión que ya se tomó para el lado empresa: el expediente
 * se resuelve solo en segundos y **se dice en pantalla que la revisión
 * fue automática, no humana**. Esa segunda mitad no es opcional. Aprobar
 * a todo el mundo en dos segundos y llamarlo "verificación" sería
 * exactamente el tipo de afirmación que este producto promete no hacer
 * (docs/design-system.md §5.2, "la honestidad sobre el dato").
 *
 * Tres cosas que sí se comprueban, porque saltearlas convertiría esto en
 * un endpoint para aprobar a cualquiera:
 *
 *   1. La wallet sale del token de Privy, NUNCA del body — igual que en
 *      /api/compliance/application. Nadie aprueba a nombre de otro.
 *   2. Solo se aprueba lo que está en `Pending`. Sin esto, una llamada
 *      repetida gastaría gas reaprobando, y peor: reviviría un acceso
 *      que un operador acababa de rechazar o revocar a mano.
 *   3. Rate limit público, como el resto de las rutas sin API key.
 */
export async function POST(req: Request) {
  const denied = await requirePublicRateLimit(req);
  if (denied) return denied;

  const wallet = await getAuthenticatedWallet(req);
  if (!wallet) {
    return NextResponse.json(
      { error: "Inicia sesión para solicitar acceso" },
      { status: 401 },
    );
  }

  try {
    const status = await getAccessStatus(wallet as Address);

    // Ya aprobada: no hay nada que hacer y no es un error.
    if (status === 2) return NextResponse.json({ ok: true, alreadyApproved: true });

    // Rechazada (3) o revocada (4) por una persona: la decisión humana
    // manda sobre la automática. Que este endpoint pudiera deshacerla
    // volvería inútil el panel del operador.
    if (status !== 1) {
      return NextResponse.json(
        { error: "Esta cuenta no tiene una solicitud en revisión" },
        { status: 409 },
      );
    }

    const hash = await decideAccess(wallet as Address, true);
    return NextResponse.json({ ok: true, hash, automated: true });
  } catch (err) {
    console.error("[compliance] la revisión automática falló:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "No se pudo resolver la solicitud automáticamente",
      },
      { status: 502 },
    );
  }
}
