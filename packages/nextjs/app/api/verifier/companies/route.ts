import { NextResponse } from "next/server";
import { requireVerifierAuth } from "@/lib/verifier/auth";
import { withDbErrors } from "@/lib/verifier/apiError";
import { listCompanies } from "@/lib/verifier/companies";

/** Cola de acreditación: las empresas que esperan revisión van primero. */
export async function GET(req: Request) {
  const denied = await requireVerifierAuth(req);
  if (denied) return denied;

  return withDbErrors(async () => NextResponse.json(await listCompanies()));
}
