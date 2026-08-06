import { NextResponse } from "next/server";
import { withDbErrors } from "@/lib/verifier/apiError";
import { listActivityForInvestor } from "@/lib/db/onchainActivity";

/**
 * Actividad on-chain de una wallet. Sin auth a propósito: todo lo que
 * devuelve ya es público en Arbiscan — son eventos de un contrato, no
 * datos personales. Pedir una firma para leer lo que cualquiera puede
 * leer en el explorador sería fricción sin beneficio.
 */
export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json(
      { error: "Falta el parámetro wallet o no es una dirección válida" },
      { status: 400 },
    );
  }

  return withDbErrors(async () => {
    const activity = await listActivityForInvestor(wallet);
    return NextResponse.json(activity);
  });
}
