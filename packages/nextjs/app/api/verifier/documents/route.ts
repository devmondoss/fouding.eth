import { NextResponse } from "next/server";
import { requirePublicRateLimit } from "@/lib/verifier/auth";
import { getAuthenticatedWallet } from "@/lib/privyServer";
import { withDbErrors } from "@/lib/verifier/apiError";
import { saveDocument } from "@/lib/verifier/documents";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB — de sobra para un legal pack en PDF

/**
 * Sube el documento y devuelve su hash — ese hash es lo único que
 * después va en `legalPackHash` del expediente y, más adelante, onchain.
 *
 * Dos clientes legítimos, dos credenciales: la empresa desde
 * app/solicitar con su sesión de Privy, y el verificador desde su panel
 * con la API key. Antes no pedía ninguna de las dos, así que cualquiera
 * podía llenar la tabla de documentos.
 */
export async function POST(req: Request) {
  const denied = await requirePublicRateLimit(req);
  if (denied) return denied;

  const auth = req.headers.get("authorization");
  const verifierKey = process.env.VERIFIER_API_KEY;
  const isVerifier =
    Boolean(verifierKey) && auth === `Bearer ${verifierKey}`;

  if (!isVerifier && !(await getAuthenticatedWallet(req))) {
    return NextResponse.json(
      { error: "Inicia sesión para subir documentos" },
      { status: 401 },
    );
  }

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

  return withDbErrors(async () => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await saveDocument(bytes, file.name, file.type || "application/octet-stream");

    return NextResponse.json(doc, { status: 201 });
  });
}
