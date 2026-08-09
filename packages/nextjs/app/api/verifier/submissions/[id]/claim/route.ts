import { NextResponse } from "next/server";
import { requireVerifierAuth } from "@/lib/verifier/auth";
import { withDbErrors } from "@/lib/verifier/apiError";
import { claimSubmission, getSubmission } from "@/lib/verifier/store";

/**
 * Un verificador toma un expediente de la cola.
 *
 * Existe porque el circuito tenía un agujero visible desde el lado de la
 * empresa: un expediente pasaba de "Pendiente" a "Aprobado" sin que nadie
 * pudiera decir quién lo estaba mirando ni desde cuándo. Tomarlo escribe
 * `reviewer` + `review_started_at` y un evento en la bitácora, que es lo
 * que el dashboard de la empresa muestra como seguimiento.
 *
 * Es un candado optimista, no un lock real: el UPDATE solo pega si el
 * expediente sigue en `pending`, así que dos verificadores que hagan clic
 * a la vez no se pisan — el segundo recibe 409.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireVerifierAuth(req);
  if (denied) return denied;

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { reviewer?: string } | null;
  const reviewer = body?.reviewer?.trim();

  if (!reviewer) {
    return NextResponse.json(
      { error: "reviewer es obligatorio: la revisión lleva nombre" },
      { status: 400 },
    );
  }

  return withDbErrors(async () => {
    const claimed = await claimSubmission(id, reviewer);
    if (claimed) return NextResponse.json(claimed);

    // No pegó el UPDATE: o no existe, o ya lo tomó alguien. Distinguirlo
    // importa — el mensaje de "lo tomó otro" es accionable, el de "no
    // existe" es un bug.
    const current = await getSubmission(id);
    if (!current) {
      return NextResponse.json(
        { error: "Expediente no encontrado" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        error:
          current.status === "in_review"
            ? `Ya lo está revisando ${current.reviewer ?? "otro verificador"}`
            : "El expediente ya fue decidido",
      },
      { status: 409 },
    );
  });
}
