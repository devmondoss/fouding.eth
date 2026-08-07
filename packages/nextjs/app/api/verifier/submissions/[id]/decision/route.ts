import { NextResponse } from "next/server";
import { requireVerifierAuth } from "@/lib/verifier/auth";
import { withDbErrors } from "@/lib/verifier/apiError";
import { decideSubmission, getSubmission } from "@/lib/verifier/store";
import { synchronizeApprovedPassport } from "@/lib/verifier/onchain";
import type { DecisionInput, PassportSynchronization } from "@/lib/verifier/types";

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
    if (current.status !== "pending") {
      return NextResponse.json({ error: "El expediente ya fue decidido" }, { status: 409 });
    }

    // La escritura onchain va ANTES de marcar la decisión: si el passport
    // no se puede sincronizar, el expediente tiene que seguir pendiente
    // para poder reintentarlo, no quedar aprobado sin respaldo en cadena.
    // Su error es 502 propio y no pasa por withDbErrors, que traduce
    // fallas de base de datos.
    let passport: PassportSynchronization | undefined;
    if (approve) {
      try {
        passport = await synchronizeApprovedPassport(current);
      } catch (cause) {
        return NextResponse.json(
          {
            error:
              cause instanceof Error
                ? cause.message
                : "No se pudo sincronizar el passport onchain",
          },
          { status: 502 },
        );
      }
    }

    const updated = await decideSubmission(id, {
      approve,
      decidedBy,
      note: body.note,
      passport,
    });

    if (!updated) {
      return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
    }

    return NextResponse.json(updated);
  });
}
