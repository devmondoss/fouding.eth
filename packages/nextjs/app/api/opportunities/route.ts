import { NextResponse } from "next/server";
import { withDbErrors } from "@/lib/verifier/apiError";
import { listOpportunities } from "@/lib/opportunities/store";

/**
 * Catálogo público. Es deliberadamente abierto: explorar oportunidades no
 * exige identificarse (docs/design-system.md §6, "nadie necesita registrarse
 * para mirar un catálogo"). Lo que sí exige verificación es invertir, y
 * eso lo controla AccessRegistry en cadena, no esta ruta.
 *
 * Solo devuelve datos ya publicados por el verificador; el expediente
 * crudo y sus documentos nunca salen por acá.
 */
export async function GET() {
  return withDbErrors(async () => {
    const opportunities = await listOpportunities();
    return NextResponse.json(opportunities);
  });
}
