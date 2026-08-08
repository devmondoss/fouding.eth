import { NextResponse } from "next/server";
import { withDbErrors } from "@/lib/verifier/apiError";
import {
  createListing,
  listOpenListings,
  listSellerListings,
} from "@/lib/listings/store";

/**
 * Libro de órdenes del mercado secundario. Público en lectura (igual que el
 * catálogo) — publicar y expresar interés sí exigen wallet, pero mover la
 * posición de verdad requiere una transacción firmada, así que esta ruta
 * nunca toca fondos.
 */
export async function GET(req: Request) {
  return withDbErrors(async () => {
    const params = new URL(req.url).searchParams;
    const seller = params.get("seller");
    if (seller) {
      return NextResponse.json(await listSellerListings(seller));
    }
    const slug = params.get("opportunity") ?? undefined;
    const listings = await listOpenListings(slug);
    return NextResponse.json(listings);
  });
}

export async function POST(req: Request) {
  return withDbErrors(async () => {
    const body = (await req.json().catch(() => null)) as {
      opportunitySlug?: string;
      sellerWallet?: string;
      amount?: string;
      price?: string;
    } | null;

    if (
      !body?.opportunitySlug ||
      !body.sellerWallet ||
      !body.amount ||
      !body.price
    ) {
      return NextResponse.json(
        { error: "opportunitySlug, sellerWallet, amount y price son obligatorios" },
        { status: 400 },
      );
    }
    if (!/^\d+$/.test(body.amount) || !/^\d+$/.test(body.price)) {
      return NextResponse.json(
        { error: "amount y price deben ser enteros en micro-USDC" },
        { status: 400 },
      );
    }

    const listing = await createListing({
      opportunitySlug: body.opportunitySlug,
      sellerWallet: body.sellerWallet,
      amount: body.amount,
      price: body.price,
    });
    return NextResponse.json(listing, { status: 201 });
  });
}
