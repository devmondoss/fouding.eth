import { NextResponse } from "next/server";
import { requireVerifierAuth, requirePublicRateLimit } from "@/lib/verifier/auth";
import { getAuthenticatedWallet } from "@/lib/privyServer";
import { withDbErrors } from "@/lib/verifier/apiError";
import { createSubmission, listSubmissions } from "@/lib/verifier/store";
import { getCompanyByWallet } from "@/lib/verifier/companies";
import {
  COLLATERAL_KINDS,
  PROJECT_TYPES,
  amountError,
} from "@/lib/verifier/submission";
import type { CreateSubmissionInput } from "@/lib/verifier/types";

export async function GET(req: Request) {
  const denied = await requireVerifierAuth(req);
  if (denied) return denied;

  return withDbErrors(async () => {
    const submissions = await listSubmissions();
    return NextResponse.json(submissions);
  });
}

const PROJECT_TYPE_KEYS = PROJECT_TYPES.map((t) => t.key);

const isPositiveAmount = (v: unknown): v is string =>
  typeof v === "string" && /^\d+(\.\d+)?$/.test(v) && Number(v) > 0;

/**
 * La llama app/solicitar desde el lado de la empresa, sin API key de
 * verificador — pero SÍ con la sesión de Privy de quien envía.
 *
 * `companyWallet` sale del token verificado y se ignora lo que venga en
 * el body: esa wallet es la que el IdentityRegistry habilita si el
 * expediente se aprueba, así que aceptarla como dato suelto permitía
 * mandar solicitudes a nombre de la empresa de otro.
 *
 * Las reglas de negocio (mínimo de originación, RUC válido, años de
 * operación, garantía de una clase conocida) se validan CONTRA EL MISMO
 * módulo que usa el formulario, no reescritas acá: si el mínimo cambia,
 * cambia en un solo lugar y ni el cliente ni el servidor quedan viejos.
 */
export async function POST(req: Request) {
  const denied = await requirePublicRateLimit(req);
  if (denied) return denied;

  const companyWallet = await getAuthenticatedWallet(req);
  if (!companyWallet) {
    return NextResponse.json(
      { error: "Inicia sesión para enviar una solicitud" },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => null)) as
    | (Partial<CreateSubmissionInput> & {
        yearsOperating?: number;
        termMonths?: number;
      })
    | null;

  if (!body) {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  // Una solicitud cuelga de una empresa YA acreditada. Los datos de la
  // empresa no viajan más en el body: salen de la fila verificada, que es
  // la que un verificador revisó. Pedirlos otra vez permitía declarar en
  // cada proyecto un RUC o una antigüedad distintos de los acreditados.
  const company = await getCompanyByWallet(companyWallet);
  if (!company) {
    return NextResponse.json(
      {
        error:
          "Primero acredita tu empresa: sin eso no se puede pedir financiamiento",
      },
      { status: 409 },
    );
  }
  if (company.status !== "verified") {
    return NextResponse.json(
      {
        error:
          company.status === "rejected"
            ? "Tu empresa no pasó la acreditación. Corrige lo observado y vuelve a enviarla"
            : "Tu empresa todavía está en acreditación. Te avisamos cuando haya resultado",
      },
      { status: 409 },
    );
  }

  const errors: string[] = [];

  if (!body.projectTitle?.trim()) errors.push("El título del proyecto es obligatorio");
  if (!body.projectType || !PROJECT_TYPE_KEYS.includes(body.projectType)) {
    errors.push("El tipo de proyecto no es uno de los ofrecidos");
  }
  if (!body.useOfFunds?.trim()) errors.push("Falta el destino del capital");

  const amount = amountError(body.requestedAmount ?? "");
  if (amount) errors.push(amount);

  if (!body.termMonths || body.termMonths <= 0) {
    errors.push("El plazo debe ser un número de meses positivo");
  }

  if (
    !body.collateralKind ||
    !COLLATERAL_KINDS.includes(
      body.collateralKind as (typeof COLLATERAL_KINDS)[number],
    )
  ) {
    errors.push("La garantía debe ser maquinaria, vehículo o inmueble");
  }
  if (!isPositiveAmount(body.collateralValue ?? "")) {
    errors.push("El valor declarado de la garantía debe ser mayor que cero");
  }

  // El legal pack es opcional (el verificador lo pide si le falta), pero
  // si viene tiene que ser un bytes32 de verdad: es lo único de este
  // expediente que termina anclado en cadena.
  if (body.legalPackHash && !/^0x[a-fA-F0-9]{64}$/.test(body.legalPackHash)) {
    errors.push("legalPackHash debe ser un bytes32 (0x + 64 hex)");
  }

  if (errors.length) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }

  return withDbErrors(async () => {
    const submission = await createSubmission({
      // Copiados de la empresa acreditada, no de lo que mande el cliente:
      // el expediente guarda el retrato de la empresa en el momento de
      // pedir, y ese retrato tiene que ser el verificado.
      companyId: company.id,
      companyName: company.name,
      companyRuc: company.ruc,
      companyWallet,
      sector: company.sector,
      city: company.city,
      yearsOperating: company.yearsOperating,
      annualRevenue: company.annualRevenue,
      projectTitle: body.projectTitle!.trim(),
      projectType: body.projectType!,
      useOfFunds: body.useOfFunds!.trim(),
      requestedAmount: body.requestedAmount!,
      termMonths: body.termMonths!,
      collateralKind: body.collateralKind!,
      collateralValue: body.collateralValue!,
      collateralDetail: body.collateralDetail?.trim() ?? "",
      legalPackHash: body.legalPackHash ?? "",
      legalPackName: body.legalPackName?.trim() ?? "",
    });

    return NextResponse.json(submission, { status: 201 });
  });
}
