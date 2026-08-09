import { NextResponse } from "next/server";
import { requireVerifierAuth } from "@/lib/verifier/auth";
import { withDbErrors } from "@/lib/verifier/apiError";
import { decideCompany, getCompany } from "@/lib/verifier/companies";
import { synchronizeCompanyPassport } from "@/lib/verifier/onchain";
import type { PassportSynchronization } from "@/lib/verifier/types";

/**
 * Acreditar (o rechazar) una empresa. Este es el acto que emite el
 * pasaporte onchain — antes lo hacía la aprobación de un expediente, que
 * mezclaba acreditar al sujeto con aprobar una operación suya.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireVerifierAuth(req);
  if (denied) return denied;

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    approve?: boolean;
    decidedBy?: string;
    note?: string;
  } | null;

  if (typeof body?.approve !== "boolean" || !body.decidedBy) {
    return NextResponse.json(
      { error: "approve (boolean) y decidedBy son obligatorios" },
      { status: 400 },
    );
  }
  const { approve, decidedBy } = body;

  return withDbErrors(async () => {
    const current = await getCompany(id);
    if (!current) {
      return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
    }
    if (current.status !== "pending" && current.status !== "in_review") {
      return NextResponse.json(
        { error: "Esa empresa ya fue acreditada o rechazada" },
        { status: 409 },
      );
    }

    // La escritura onchain va ANTES de marcar la acreditación: si el
    // pasaporte no se puede emitir, la empresa sigue en revisión para
    // poder reintentarlo, no queda "verificada" sin respaldo en cadena.
    let passport: PassportSynchronization | undefined;
    if (approve) {
      try {
        passport = await synchronizeCompanyPassport(current);
      } catch (cause) {
        return NextResponse.json(
          {
            error:
              cause instanceof Error
                ? cause.message
                : "No se pudo emitir el pasaporte onchain",
          },
          { status: 502 },
        );
      }
    }

    const updated = await decideCompany(id, {
      approve,
      decidedBy,
      note: body.note,
      passport,
    });
    if (!updated) {
      return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
    }
    return NextResponse.json(updated);
  });
}
