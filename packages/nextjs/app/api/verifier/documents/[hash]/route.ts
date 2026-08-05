import { NextResponse } from "next/server";
import { requireVerifierAuth } from "@/lib/verifier/auth";
import { readDocument } from "@/lib/verifier/documents";

/** Sirve el documento — protegido, porque tiene datos sensibles de la
 * empresa (ver lib/verifier/documents.ts). Solo el verificador lo ve. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const denied = requireVerifierAuth(req);
  if (denied) return denied;

  const { hash } = await params;
  const doc = await readDocument(hash);
  if (!doc) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(doc.bytes), {
    headers: {
      "Content-Type": doc.meta.mimeType,
      "Content-Disposition": `inline; filename="${doc.meta.fileName}"`,
    },
  });
}
