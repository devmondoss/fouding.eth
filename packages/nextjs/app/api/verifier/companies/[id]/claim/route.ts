import { NextResponse } from "next/server";
import { requireVerifierAuth } from "@/lib/verifier/auth";
import { withDbErrors } from "@/lib/verifier/apiError";
import { claimCompany, getCompany } from "@/lib/verifier/companies";

/** Tomar una empresa de la cola de acreditación. Mismo candado optimista
 * que un expediente: el UPDATE solo pega si sigue en `pending`. */
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
    const claimed = await claimCompany(id, reviewer);
    if (claimed) return NextResponse.json(claimed);

    const current = await getCompany(id);
    if (!current) {
      return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
    }
    return NextResponse.json(
      {
        error:
          current.status === "in_review"
            ? `Ya la está revisando ${current.reviewer ?? "otro verificador"}`
            : "Esa empresa ya fue acreditada o rechazada",
      },
      { status: 409 },
    );
  });
}
