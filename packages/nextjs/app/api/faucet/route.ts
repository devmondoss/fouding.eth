import { NextResponse } from "next/server";
import { getAuthenticatedWallet } from "@/lib/privyServer";
import { requirePublicRateLimit } from "@/lib/verifier/auth";
import { withDbErrors } from "@/lib/verifier/apiError";
import { FaucetUnavailable, dispense, getTopUpStatus } from "@/lib/faucet/dispenser";

/**
 * Recarga de prueba: gas + mUSDC para la wallet de quien está logueado.
 *
 * La wallet SIEMPRE sale del token de Privy verificado, nunca del body
 * ni de un query param: si la aceptáramos suelta, esta ruta sería un
 * grifo abierto para vaciar la cuenta operadora hacia cualquier
 * dirección.
 */

export async function GET(req: Request) {
  const wallet = await getAuthenticatedWallet(req);
  const status = await getTopUpStatus(wallet ?? undefined);
  return NextResponse.json(status);
}

export async function POST(req: Request) {
  const denied = await requirePublicRateLimit(req);
  if (denied) return denied;

  const wallet = await getAuthenticatedWallet(req);
  if (!wallet) {
    return NextResponse.json(
      { error: "Inicia sesión para recibir saldo de prueba" },
      { status: 401 },
    );
  }

  return withDbErrors(async () => {
    try {
      return NextResponse.json(await dispense(wallet));
    } catch (cause) {
      // 503 y no 500: no es un bug, es que la dispensadora no está
      // disponible (sin llave, sin gas, sin fondos, en enfriamiento), y
      // el mensaje ya viene escrito para mostrarse tal cual.
      if (cause instanceof FaucetUnavailable) {
        return NextResponse.json({ error: cause.message }, { status: 503 });
      }
      console.error("[faucet] falló la recarga:", cause);
      return NextResponse.json(
        { error: "No se pudo completar la recarga, intenta de nuevo" },
        { status: 502 },
      );
    }
  });
}
