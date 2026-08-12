import { NextResponse } from "next/server";
import { getAuthenticatedWallet } from "@/lib/privyServer";
import { requirePublicRateLimit } from "@/lib/verifier/auth";
import { withDbErrors } from "@/lib/verifier/apiError";
import {
  CompanyAlreadyVerified,
  getCompanyByWallet,
  submitCompany,
} from "@/lib/verifier/companies";
import { MIN_YEARS_OPERATING, rucError } from "@/lib/verifier/submission";

/**
 * La acreditación de la empresa, que es lo que hay que tener ANTES de
 * poder pedir financiamiento. La wallet sale del token de Privy, nunca
 * del body: es la que va a recibir el pasaporte onchain.
 */

export async function GET(req: Request) {
  const wallet = await getAuthenticatedWallet(req);
  if (!wallet) {
    return NextResponse.json(
      { error: "Inicia sesión para ver tu empresa" },
      { status: 401 },
    );
  }
  return withDbErrors(async () =>
    NextResponse.json(await getCompanyByWallet(wallet)),
  );
}

export async function POST(req: Request) {
  const denied = await requirePublicRateLimit(req);
  if (denied) return denied;

  const wallet = await getAuthenticatedWallet(req);
  if (!wallet) {
    return NextResponse.json(
      { error: "Inicia sesión para acreditar tu empresa" },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const texto = (k: string) => String(body[k] ?? "").trim();
  const entero = (k: string) => Number(body[k] ?? 0);

  const errors: string[] = [];
  if (!texto("name")) errors.push("La razón social es obligatoria");

  const ruc = rucError(texto("ruc"));
  if (ruc) errors.push(ruc);

  if (!texto("sector")) errors.push("El sector es obligatorio");
  if (!texto("city")) errors.push("La ciudad es obligatoria");
  if (entero("yearsOperating") < MIN_YEARS_OPERATING) {
    errors.push(
      `Árbitro acredita empresas con al menos ${MIN_YEARS_OPERATING} años de operación`,
    );
  }

  const hash = texto("legalPackHash");
  if (hash && !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    errors.push("legalPackHash debe ser un bytes32 (0x + 64 hex)");
  }

  if (errors.length) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }

  return withDbErrors(async () => {
    try {
      const company = await submitCompany({
        ruc: texto("ruc").replace(/\D/g, ""),
        wallet,
        name: texto("name"),
        sector: texto("sector"),
        city: texto("city"),
        yearsOperating: entero("yearsOperating"),
        employees: entero("employees"),
        annualRevenue: /^\d+$/.test(texto("annualRevenue"))
          ? texto("annualRevenue")
          : "",
        legalPackHash: hash,
        legalPackName: texto("legalPackName"),
      });
      return NextResponse.json(company, { status: 201 });
    } catch (cause) {
      // El RUC identifica a la empresa y su historial de pagos cuelga de
      // ahí: dejar que otra wallet lo reclame reescribiría un pasaporte
      // ajeno (409, no 500 — no es una falla, es una colisión legítima).
      if (cause instanceof CompanyAlreadyVerified) {
        return NextResponse.json({ error: cause.message }, { status: 409 });
      }
      throw cause;
    }
  });
}
