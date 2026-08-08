import { NextResponse } from "next/server";
import { withDbErrors } from "@/lib/verifier/apiError";
import { cancelListing, expressInterest, markFilled } from "@/lib/listings/store";

type Action =
  | { action: "interest"; wallet: string }
  | { action: "fill"; sellerWallet: string; txHash: string }
  | { action: "cancel"; sellerWallet: string };

/**
 * Tres transiciones, todas idempotentes contra el estado actual (el UPDATE
 * en lib/listings/store.ts trae WHERE status = ... para eso): un comprador
 * se anota, el vendedor confirma que ya transfirió on-chain, o el vendedor
 * cancela. Tres verbos, no un CRUD genérico — cada uno es la única forma
 * válida de tocar esa fila desde el punto en el flujo donde vive.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withDbErrors(async () => {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as Action | null;
    if (!body?.action) {
      return NextResponse.json({ error: "action es obligatorio" }, { status: 400 });
    }

    if (body.action === "interest") {
      if (!body.wallet) {
        return NextResponse.json({ error: "wallet es obligatorio" }, { status: 400 });
      }
      const listing = await expressInterest(id, body.wallet);
      if (!listing) {
        return NextResponse.json(
          { error: "La publicación ya no está abierta" },
          { status: 409 },
        );
      }
      return NextResponse.json(listing);
    }

    if (body.action === "fill") {
      if (!body.sellerWallet || !body.txHash) {
        return NextResponse.json(
          { error: "sellerWallet y txHash son obligatorios" },
          { status: 400 },
        );
      }
      const listing = await markFilled(id, body.sellerWallet, body.txHash);
      if (!listing) {
        return NextResponse.json(
          { error: "No se encontró la publicación para esa wallet" },
          { status: 404 },
        );
      }
      return NextResponse.json(listing);
    }

    if (body.action === "cancel") {
      if (!body.sellerWallet) {
        return NextResponse.json(
          { error: "sellerWallet es obligatorio" },
          { status: 400 },
        );
      }
      const listing = await cancelListing(id, body.sellerWallet);
      if (!listing) {
        return NextResponse.json(
          { error: "No se pudo cancelar (ya vendida o no existe)" },
          { status: 409 },
        );
      }
      return NextResponse.json(listing);
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  });
}
