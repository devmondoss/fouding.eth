"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Field";
import { Bloque, Cifra, Encabezado } from "./FichaTab";
import { formatUsdc } from "@/lib/format";
import { useSession } from "@/lib/useSession";

type Listing = {
  id: string;
  opportunitySlug: string;
  sellerWallet: string;
  amount: string;
  price: string;
  status: "open" | "interested" | "filled" | "cancelled";
  interestedWallet: string | null;
};

/**
 * Lado comprador del libro de órdenes. `transfer_position` en el contrato
 * no liquida pago — esta lista es matching de intención: marcar interés no
 * mueve nada on-chain, solo le avisa al vendedor a quién transferirle una
 * vez coordinado el pago fuera de cadena (ver PortfolioOverlay para el
 * lado del vendedor, que sí ejecuta la transacción real).
 *
 * La pestaña abría repitiendo su propio nombre y sin decir lo único que
 * un comprador quiere saber antes de leer la lista: si hay algo y a qué
 * precio respecto del nominal. Eso ahora está en el encabezado, y cada
 * publicación dice su descuento —que es el dato de la operación, no el
 * precio suelto.
 */
export function OrderBook({ opportunitySlug }: { opportunitySlug: string }) {
  const { session } = useSession();
  const wallet = session?.address;
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(
      `/api/listings?opportunity=${encodeURIComponent(opportunitySlug)}`,
    );
    if (res.ok) setListings((await res.json()) as Listing[]);
  }

  useEffect(() => {
    refresh().catch(() => setListings([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunitySlug]);

  async function expressInterest(id: string) {
    if (!wallet) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "interest", wallet }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "No se pudo registrar el interés");
      }
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Algo salió mal");
    } finally {
      setBusyId(null);
    }
  }

  const open = (listings ?? []).filter(
    (l) => l.status === "open" || l.status === "interested",
  );
  const nominal = open.reduce((acc, l) => acc + BigInt(l.amount), 0n);
  const pedido = open.reduce((acc, l) => acc + BigInt(l.price), 0n);

  return (
    <div>
      <Encabezado>
        <Cifra
          label="En venta"
          value={open.length}
          nota={open.length === 1 ? "publicación" : "publicaciones"}
        />
        {open.length > 0 && (
          <>
            <Cifra
              label="Nominal"
              value={formatUsdc(nominal)}
              nota="USDC de capital"
            />
            <Cifra
              label="Piden"
              value={formatUsdc(pedido)}
              nota={`USDC · ${descuento(nominal, pedido)}`}
            />
          </>
        )}
      </Encabezado>

      <Bloque
        titulo="Publicaciones"
        aparte={
          <span className="text-[11.5px] text-low">
            Marcar interés no mueve fondos
          </span>
        }
      >
        {listings === null ? (
          <p className="text-[12.5px] text-low">Cargando publicaciones…</p>
        ) : open.length === 0 ? (
          <EmptyState
            title="Nada publicado todavía"
            detail="Cuando un inversionista publique su posición en venta va a aparecer acá."
          />
        ) : (
          <div className="flex flex-col">
            {open.map((l) => {
              const mine = wallet?.toLowerCase() === l.sellerWallet.toLowerCase();
              const alreadyInterested =
                wallet &&
                l.interestedWallet?.toLowerCase() === wallet.toLowerCase();
              const monto = BigInt(l.amount);
              const precio = BigInt(l.price);

              return (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="num text-[13px] font-semibold text-hi">
                      {formatUsdc(precio)}{" "}
                      <span className="text-[11.5px] font-normal text-low">
                        por {formatUsdc(monto)} USDC de capital
                      </span>
                    </div>
                    <div className="text-[11.5px] text-low">
                      {descuento(monto, precio)}
                    </div>
                  </div>

                  {mine ? (
                    <span className="shrink-0 text-[11.5px] text-low">
                      Tu publicación
                    </span>
                  ) : l.status === "interested" ? (
                    <span className="shrink-0 text-[11.5px] text-low">
                      Ya tiene interesado
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!wallet || Boolean(alreadyInterested)}
                      loading={busyId === l.id}
                      onClick={() => expressInterest(l.id)}
                    >
                      {alreadyInterested ? "Interés registrado" : "Me interesa"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <p className="mt-2.5 text-[11.5px]" style={{ color: "var(--negative)" }}>
            {error}
          </p>
        )}
      </Bloque>
    </div>
  );
}

/** Comprar una posición por menos de su nominal es el negocio del
 *  secundario; el precio suelto no lo dice y la resta la hacía el
 *  comprador de cabeza. */
function descuento(nominal: bigint, precio: bigint): string {
  if (nominal === 0n) return "—";
  const bps = Number(((nominal - precio) * 10000n) / nominal);
  if (bps === 0) return "a la par";
  const pct = Math.abs(bps / 100).toFixed(1);
  return bps > 0 ? `${pct}% bajo el nominal` : `${pct}% sobre el nominal`;
}
