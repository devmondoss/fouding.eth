import { NextResponse } from "next/server";
import { requirePublicRateLimit } from "@/lib/verifier/auth";
import { withDbErrors } from "@/lib/verifier/apiError";
import { listSubmissionsByWallet } from "@/lib/verifier/store";

/**
 * Consulta pública, sin API key: una empresa logueada con su wallet
 * (Privy, ver app/solicitar) ve el estado de SUS solicitudes.
 *
 * OJO — no valida que quien pregunta sea dueño de esa wallet (no hay
 * firma de por medio, solo Privy autenticándola del lado del cliente).
 * Cualquiera que conozca una dirección podría consultar su estado.
 * Aceptable para el alcance actual: lo que se expone (nombre, monto,
 * estado) no es información sensible — el expediente completo y los
 * documentos siguen exigiendo la key del verificador.
 */
export async function GET(req: Request) {
  const denied = await requirePublicRateLimit(req);
  if (denied) return denied;

  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json(
      { error: "Parámetro wallet inválido o ausente" },
      { status: 400 },
    );
  }

  return withDbErrors(async () => {
    const submissions = await listSubmissionsByWallet(wallet);
    return NextResponse.json(submissions);
  });
}
