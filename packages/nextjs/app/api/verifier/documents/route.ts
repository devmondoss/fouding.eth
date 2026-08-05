import { NextResponse } from "next/server";
import { requireVerifierAuth } from "@/lib/verifier/auth";
import { saveDocument } from "@/lib/verifier/documents";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB — de sobra para un legal pack en PDF

/**
 * Sube el documento y devuelve su hash — ese hash es lo único que
 * después va en `legalPackHash` del expediente y, más adelante, onchain.
 *
 * Protegido con la misma API key que el resto de rutas del verificador:
 * hoy no existe un login separado para la empresa que sube el
 * documento, así que esto evita que cualquiera suba archivos arbitrarios
 * al storage. Cuando haya un flujo real del lado de la empresa, esto
 * necesita su propia auth.
 */
export async function POST(req: Request) {
  const denied = await requireVerifierAuth(req);
  if (denied) return denied;

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo (campo 'file')" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Máximo 10MB" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await saveDocument(bytes, file.name, file.type || "application/octet-stream");

  return NextResponse.json(doc, { status: 201 });
}
