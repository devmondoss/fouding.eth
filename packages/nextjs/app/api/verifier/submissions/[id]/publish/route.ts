import { NextResponse } from "next/server";
import { requireVerifierAuth } from "@/lib/verifier/auth";
import { withDbErrors } from "@/lib/verifier/apiError";
import { getSubmission } from "@/lib/verifier/store";
import {
  createOpportunity,
  getOpportunityBySubmission,
  uniqueSlug,
  upsertCompany,
} from "@/lib/opportunities/store";
import { HAIRCUT_BY_KIND, type CollateralKind, type Milestone } from "@/lib/types";
import type { WireCollateral } from "@/lib/opportunities/wire";

/**
 * Publica un expediente aprobado como oportunidad del catálogo.
 *
 * Este es el eslabón que faltaba: hasta ahora una empresa podía enviar su
 * expediente y el verificador aprobarlo (emitiendo su passport en cadena),
 * pero eso no producía NADA visible para un inversionista — el catálogo
 * salía entero de lib/data/seed.ts.
 *
 * Aprobar y publicar son dos actos distintos a propósito. Aprobar dice
 * "esta empresa es quien dice ser"; publicar dice "y estas son las
 * condiciones del crédito". Lo segundo es el underwriting (start.md
 * §Flujo del administrador) y necesita datos que el expediente no trae:
 * colateral tasado, plazo, tasa e hitos.
 */

const KINDS: CollateralKind[] = ["machinery", "vehicle", "real_estate"];

type PublishBody = {
  // Empresa
  sector?: string;
  city?: string;
  yearsOperating?: number;
  employees?: number;
  verifiedRevenue?: string;
  // Oportunidad
  summary?: string;
  highlights?: string[];
  targetAmount?: string;
  borrowerContributionBps?: number;
  termMonths?: number;
  apyBps?: number;
  fundingDeadline?: string;
  collateral?: {
    kind?: CollateralKind;
    description?: string;
    appraisedValue?: string;
    haircutBps?: number;
    registryEntry?: string | null;
    titleVerified?: boolean;
    liens?: string[];
  };
  milestones?: Milestone[];
};

const isAmount = (v: unknown): v is string =>
  typeof v === "string" && /^\d+$/.test(v);

const isBps = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 10_000;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireVerifierAuth(req);
  if (denied) return denied;

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as PublishBody | null;
  if (!body) {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const c = body.collateral;
  const errors: string[] = [];

  if (!c || !c.kind || !KINDS.includes(c.kind)) {
    errors.push("collateral.kind debe ser machinery, vehicle o real_estate");
  }
  if (!c || !isAmount(c.appraisedValue)) {
    errors.push("collateral.appraisedValue debe ser un entero en micro-USDC");
  }
  if (!isBps(body.apyBps)) errors.push("apyBps debe estar entre 0 y 10000");
  if (
    typeof body.termMonths !== "number" ||
    !Number.isInteger(body.termMonths) ||
    body.termMonths <= 0
  ) {
    errors.push("termMonths debe ser un entero positivo");
  }
  // Obligatorio, y NO se hereda de submission.requestedAmount: ese campo
  // guarda lo que tecleó la empresa en USDC ("50000"), mientras que acá
  // todo monto es micro-USDC. Heredarlo dividiría la cifra por 10^6 sin
  // que nadie lo note.
  if (!isAmount(body.targetAmount)) {
    errors.push("targetAmount es obligatorio y debe ser un entero en micro-USDC");
  }
  if (
    body.borrowerContributionBps !== undefined &&
    !isBps(body.borrowerContributionBps)
  ) {
    errors.push("borrowerContributionBps debe estar entre 0 y 10000");
  }
  if (!body.fundingDeadline || Number.isNaN(Date.parse(body.fundingDeadline))) {
    errors.push("fundingDeadline debe ser una fecha válida");
  }

  // Los hitos son el cronograma del escrow: si no suman el 100% del
  // capital, quedaría plata encerrada en el contrato sin condición que la
  // libere. Se valida acá porque es la última frontera antes de publicar.
  const milestones = body.milestones ?? [];
  if (milestones.length > 0) {
    const total = milestones.reduce((acc, m) => acc + (m.releaseBps ?? 0), 0);
    if (total !== 10_000) {
      errors.push(
        `los releaseBps de los hitos deben sumar 10000, suman ${total}`,
      );
    }
  }

  if (errors.length) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }

  return withDbErrors(async () => {
    const submission = await getSubmission(id);
    if (!submission) {
      return NextResponse.json(
        { error: "Expediente no encontrado" },
        { status: 404 },
      );
    }
    if (submission.status !== "approved") {
      return NextResponse.json(
        { error: "Solo se puede publicar un expediente aprobado" },
        { status: 409 },
      );
    }
    if (!submission.companyRuc) {
      return NextResponse.json(
        { error: "El expediente no tiene RUC: no se puede identificar la empresa" },
        { status: 409 },
      );
    }

    const already = await getOpportunityBySubmission(id);
    if (already) {
      return NextResponse.json(
        { error: `Este expediente ya se publicó como "${already.slug}"`, slug: already.slug },
        { status: 409 },
      );
    }

    const kind = c!.kind!;
    // El haircut por defecto sale de la tabla del dominio; el verificador
    // puede endurecerlo, no ablandarlo por debajo de lo razonable sin
    // decirlo explícitamente.
    const haircutBps = isBps(c!.haircutBps) ? c!.haircutBps! : HAIRCUT_BY_KIND[kind];
    const appraised = BigInt(c!.appraisedValue!);
    // Valor neto recuperable SIEMPRE derivado, nunca lo que mande el
    // cliente: es el único número que decide el crédito (start.md
    // §Cobertura, "no usar valor en libros como criterio decisivo").
    const netRecoverable = (appraised * BigInt(10_000 - haircutBps)) / 10_000n;

    const collateral: WireCollateral = {
      kind,
      description: c!.description?.trim() || "",
      appraisedValue: appraised.toString(),
      haircutBps,
      netRecoverableValue: netRecoverable.toString(),
      registryEntry: c!.registryEntry?.trim() || null,
      titleVerified: Boolean(c!.titleVerified),
      liens: c!.liens ?? [],
    };

    const companyId = await upsertCompany({
      ruc: submission.companyRuc,
      wallet: submission.companyWallet,
      name: submission.companyName,
      sector: body.sector?.trim() || "",
      city: body.city?.trim() || "",
      yearsOperating: body.yearsOperating ?? 0,
      employees: body.employees ?? 0,
      verifiedRevenue: isAmount(body.verifiedRevenue) ? body.verifiedRevenue : "0",
    });

    const slug = await uniqueSlug(
      `${submission.projectTitle}-${submission.companyName}`,
    );

    const opportunity = await createOpportunity({
      slug,
      companyId,
      submissionId: submission.id,
      projectTitle: submission.projectTitle,
      summary: body.summary?.trim() || "",
      highlights: body.highlights ?? [],
      targetAmount: body.targetAmount!,
      borrowerContributionBps: body.borrowerContributionBps ?? 0,
      termMonths: body.termMonths!,
      apyBps: body.apyBps!,
      collateral,
      milestones,
      legalPackHash: submission.legalPackHash,
      fundingDeadline: body.fundingDeadline!,
    });

    return NextResponse.json(opportunity, { status: 201 });
  });
}
