import { NextResponse } from "next/server";
import { getPublicCompanyEvidence } from "@/lib/verifier/store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "Wallet inválida" }, { status: 400 });
  }

  const evidence = await getPublicCompanyEvidence(wallet);
  if (!evidence) {
    return NextResponse.json(
      { error: "Evidencia no encontrada" },
      { status: 404 },
    );
  }

  return NextResponse.json(evidence, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
