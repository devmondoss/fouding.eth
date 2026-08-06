import { NextResponse } from "next/server";
import { requireVerifierAuth, requirePublicRateLimit } from "@/lib/verifier/auth";
import { getAuthenticatedWallet } from "@/lib/privyServer";
import { withDbErrors } from "@/lib/verifier/apiError";
import { createSubmission, listSubmissions } from "@/lib/verifier/store";
import type { CreateSubmissionInput } from "@/lib/verifier/types";

export async function GET(req: Request) {
  const denied = await requireVerifierAuth(req);
  if (denied) return denied;

  return withDbErrors(async () => {
    const submissions = await listSubmissions();
    return NextResponse.json(submissions);
  });
}

/**
 * La llama app/solicitar desde el lado de la empresa, sin API key de
 * verificador — pero SÍ con la sesión de Privy de quien envía.
 *
 * `companyWallet` sale del token verificado y se ignora lo que venga en
 * el body: esa wallet es la que el IdentityRegistry habilita si el
 * expediente se aprueba, así que aceptarla como dato suelto permitía
 * mandar solicitudes a nombre de la empresa de otro.
 */
export async function POST(req: Request) {
  const denied = await requirePublicRateLimit(req);
  if (denied) return denied;

  const companyWallet = await getAuthenticatedWallet(req);
  if (!companyWallet) {
    return NextResponse.json(
      { error: "Inicia sesión para enviar una solicitud" },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => null)) as Partial<CreateSubmissionInput> | null;

  if (!body?.companyName || !body.projectTitle || !body.requestedAmount) {
    return NextResponse.json(
      {
        error: "companyName, projectTitle y requestedAmount son obligatorios",
      },
      { status: 400 },
    );
  }

  return withDbErrors(async () => {
    const submission = await createSubmission({
      companyName: body.companyName!,
      companyRuc: body.companyRuc ?? "",
      companyWallet,
      projectTitle: body.projectTitle!,
      requestedAmount: body.requestedAmount!,
      legalPackHash: body.legalPackHash ?? "",
    });

    return NextResponse.json(submission, { status: 201 });
  });
}
