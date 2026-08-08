"use client";

import { useEffect, useState } from "react";
import { Tag as TagIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Field";
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
 * vez coordinado el pago fuera de cadena (ver PortfolioOverlay para el lado
 * del vendedor, que sí ejecuta la transacción real).
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

  const open = (listings ?? []).filter((l) => l.status === "open" || l.status === "interested");

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="h3">Mercado secundario</h3>
          <p className="mt-1 text-[12.5px] text-mid">
            Posiciones publicadas por otros inversionistas. Marcar interés no
            mueve fondos — el vendedor ejecuta la transferencia una vez
            coordinado el pago.
          </p>
        </div>
      </div>

      {listings === null ? (
        <p className="mt-4 text-[12.5px] text-low">Cargando publicaciones…</p>
      ) : open.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nada publicado todavía"
            detail="Cuando un inversionista publique su posición en venta va a aparecer acá."
          />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {open.map((l) => {
            const mine = wallet?.toLowerCase() === l.sellerWallet.toLowerCase();
            const alreadyInterested =
              wallet && l.interestedWallet?.toLowerCase() === wallet.toLowerCase();
            return (
              <div
                key={l.id}
                className="flex items-center justify-between gap-3 rounded-[var(--r-panel)] border border-border px-3.5 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <TagIcon className="h-3.5 w-3.5 shrink-0 text-low" />
                  <div>
                    <div className="num text-[13px] font-semibold text-hi">
                      {formatUsdc(BigInt(l.amount))} USDC
                    </div>
                    <div className="num text-[11.5px] text-low">
                      Precio: {formatUsdc(BigInt(l.price))} USDC
                    </div>
                  </div>
                </div>
                {mine ? (
                  <span className="text-[11.5px] text-low">Tu publicación</span>
                ) : l.status === "interested" ? (
                  <span className="text-[11.5px] text-low">Ya tiene interesado</span>
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
        <p className="mt-3 text-[11.5px]" style={{ color: "var(--negative)" }}>
          {error}
        </p>
      )}
    </section>
  );
}
