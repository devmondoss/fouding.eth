import { NextResponse } from "next/server";
import { getAuthenticatedWallet } from "@/lib/privyServer";
import { withDbErrors } from "@/lib/verifier/apiError";
import { requirePublicRateLimit } from "@/lib/verifier/auth";
import { saveAccessApplication } from "@/lib/compliance/applications";

/**
 * Guarda la identidad declarada por quien pide acceso, y devuelve el hash
 * que va a quedar onchain.
 *
 * La wallet sale del token de Privy, nunca del body: nadie puede declarar
 * una identidad a nombre de la wallet de otro.
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

  const body = (await req.json().catch(() => null)) as {
    fullName?: string;
    documentId?: string;
  } | null;

  if (!body?.fullName?.trim() || !body.documentId?.trim()) {
    return NextResponse.json(
      { error: "El nombre y el documento son obligatorios" },
      { status: 400 },
    );
  }

  return withDbErrors(async () => {
    const application = await saveAccessApplication({
      wallet,
      fullName: body.fullName!,
      documentId: body.documentId!,
    });
    return NextResponse.json(
      { applicationHash: application.applicationHash },
      { status: 201 },
    );
  });
}
