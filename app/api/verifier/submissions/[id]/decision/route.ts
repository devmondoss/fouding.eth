import { NextResponse } from "next/server";
import { decideSubmission } from "@/lib/verifier/store";
import type { DecisionInput } from "@/lib/verifier/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json()) as Partial<DecisionInput>;

  if (typeof body.approve !== "boolean" || !body.decidedBy) {
    return NextResponse.json(
      { error: "approve (boolean) y decidedBy son obligatorios" },
      { status: 400 },
    );
  }

  const updated = await decideSubmission(id, {
    approve: body.approve,
    decidedBy: body.decidedBy,
    note: body.note,
  });

  if (!updated) {
    return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
