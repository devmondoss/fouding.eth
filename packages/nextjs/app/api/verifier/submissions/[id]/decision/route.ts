import { NextResponse } from "next/server";
import { requireVerifierAuth } from "@/lib/verifier/auth";
import { withDbErrors } from "@/lib/verifier/apiError";
import { decideSubmission, getSubmission } from "@/lib/verifier/store";
import type { DecisionInput } from "@/lib/verifier/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireVerifierAuth(req);
  if (denied) return denied;

  const { id } = await params;
  const body = (await req.json()) as Partial<DecisionInput>;

  if (typeof body.approve !== "boolean" || !body.decidedBy) {
    return NextResponse.json(
      { error: "approve (boolean) y decidedBy son obligatorios" },
      { status: 400 },
    );
  }

  const approve = body.approve;
  const decidedBy = body.decidedBy;

  return withDbErrors(async () => {
    const current = await getSubmission(id);
    if (!current) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }
    // Se decide lo que está en cola o ya tomado; lo decidido no se
    // vuelve a decidir (aprobar mintea un soulbound: no hay deshacer).
    if (current.status !== "pending" && current.status !== "in_review") {
      return NextResponse.json({ error: "El expediente ya fue decidido" }, { status: 409 });
    }

    // El pasaporte ya NO se emite acá: pertenece a la empresa y se emite
    // al acreditarla (POST /api/verifier/companies/[id]/decision). Aprobar
    // el proyecto de una empresa ya acreditada no toca la cadena, así que
    // esta ruta dejó de poder fallar con un 502 de RPC.
    const updated = await decideSubmission(id, {
      approve,
      decidedBy,
      note: body.note,
    });

    if (!updated) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    return NextResponse.json(updated);
  });
}
