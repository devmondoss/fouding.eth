import { NextResponse } from "next/server";
import { requireVerifierAuth } from "@/lib/verifier/auth";
import { decideSubmission, getSubmission } from "@/lib/verifier/store";
import { synchronizeApprovedPassport } from "@/lib/verifier/onchain";
import type { DecisionInput } from "@/lib/verifier/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireVerifierAuth(req);
  if (denied) return denied;

  const { id } = await params;
  const body = (await req.json()) as Partial<DecisionInput>;

  if (typeof body.approve !== "boolean" || !body.decidedBy) {
    return NextResponse.json(
      { error: "approve (boolean) y decidedBy son obligatorios" },
      { status: 400 },
    );
  }

  const current = await getSubmission(id);
  if (!current) {
    return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
  }
  if (current.status !== "pending") {
    return NextResponse.json({ error: "El expediente ya fue decidido" }, { status: 409 });
  }

  let passportTxHash: string | undefined;
  if (body.approve) {
    try {
      passportTxHash = await synchronizeApprovedPassport(current);
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
    approve: body.approve,
    decidedBy: body.decidedBy,
    note: body.note,
  });

  return NextResponse.json({ ...updated, passportTxHash });
}
