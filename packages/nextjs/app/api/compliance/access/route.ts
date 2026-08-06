import { NextResponse } from "next/server";
import type { Address } from "viem";
import { requireVerifierAuth } from "@/lib/verifier/auth";
import { decideAccess, listAccessRequests } from "@/lib/compliance/onchain";
import { listAccessApplications } from "@/lib/compliance/applications";

/**
 * Solicitudes de acceso de inversionistas, y su decisión.
 *
 * Protegida con la misma API key del panel del verificador: es la misma
 * persona operando, y la clave que firma en cadena nunca sale del
 * servidor (ver lib/compliance/onchain.ts).
 */
export async function GET(req: Request) {
  const denied = await requireVerifierAuth(req);
  if (denied) return denied;

  try {
    // La cadena dice QUIÉN pidió; la base dice QUÉ declaró. Sin lo
    // segundo el panel mostraría direcciones sueltas y la decisión sería
    // a ciegas.
    const [requests, applications] = await Promise.all([
      listAccessRequests(),
      listAccessApplications().catch(() => new Map()),
    ]);

    return NextResponse.json(
      requests.map((r) => {
        const declared = applications.get(r.investor.toLowerCase());
        return {
          ...r,
          fullName: declared?.fullName ?? null,
          documentId: declared?.documentId ?? null,
          // Si no coincide, lo declarado se editó después de anclarlo.
          hashMatches: declared
            ? declared.applicationHash.toLowerCase() ===
              r.applicationHash.toLowerCase()
            : null,
        };
      }),
    );
  } catch (err) {
    console.error("[compliance] no se pudo listar solicitudes:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "No se pudieron leer las solicitudes",
      },
      { status: 503 },
    );
  }
}

export async function POST(req: Request) {
  const denied = await requireVerifierAuth(req);
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as {
    investor?: string;
    approve?: boolean;
  } | null;

  if (!body?.investor || !/^0x[a-fA-F0-9]{40}$/.test(body.investor)) {
    return NextResponse.json(
      { error: "investor debe ser una dirección EVM" },
      { status: 400 },
    );
  }
  if (typeof body.approve !== "boolean") {
    return NextResponse.json(
      { error: "approve (boolean) es obligatorio" },
      { status: 400 },
    );
  }

  try {
    const hash = await decideAccess(body.investor as Address, body.approve);
    return NextResponse.json({ ok: true, hash });
  } catch (err) {
    console.error("[compliance] no se pudo decidir el acceso:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "No se pudo registrar la decisión",
      },
      { status: 502 },
    );
  }
}
