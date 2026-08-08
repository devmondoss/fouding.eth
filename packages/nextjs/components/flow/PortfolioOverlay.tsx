"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, Send, Tag as TagIcon, X } from "lucide-react";
import { ActivityRow } from "@/components/domain/ActivityRow";
import { ClaimPanel } from "@/components/domain/ClaimPanel";
import { initials } from "@/components/domain/OpportunityCard";
import {
  CapitalOverTimeChart,
  StatusDonutChart,
} from "@/components/domain/PortfolioCharts";
import { Button } from "@/components/ui/Button";
import { EmptyState, Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { StatusPill } from "@/components/ui/Pill";
import { Metric } from "@/components/ui/Stat";
import { useCreditVault } from "@/hooks/useCreditVault";
import { usePlatform } from "@/lib/data/store";
import { formatBps, formatDate, formatUsdc, usdc } from "@/lib/format";
import { useFocusTrap, useLayerKeys } from "@/lib/keyboard";
import { dialog, scrim, slide, T } from "@/lib/motion";
import { nextMilestone, projectedReturn } from "@/lib/opportunity";
import { useSession } from "@/lib/useSession";
import { waterfallForOpportunity } from "@/lib/underwriting";
import type { Opportunity, OpportunityStatus, Position } from "@/lib/types";

type Listing = {
  id: string;
  opportunitySlug: string;
  sellerWallet: string;
  amount: string;
  price: string;
  status: "open" | "interested" | "filled" | "cancelled";
  interestedWallet: string | null;
};

const STEPS = [
  { key: "resumen", label: "Resumen" },
  { key: "posiciones", label: "Posiciones" },
  { key: "movimientos", label: "Movimientos" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

/**
 * Módulo dedicado, no un listado suelto: cuenta consolidada, distribución
 * de la cartera, próximos hitos de las operaciones activas, posiciones y
 * movimientos. Comparte el lenguaje visual de DetailOverlay a propósito —
 * es la misma clase de "espacio de trabajo" dentro del producto.
 */
export function PortfolioOverlay({
  onClose,
  onOpenOpportunity,
}: {
  onClose: () => void;
  /** Abre la ficha de la operación desde una posición o un movimiento.
   * No hay rutas: es la aplicación en un solo módulo. */
  onOpenOpportunity: (slug: string) => void;
}) {
  const { positions, activity, getOpportunity, listPosition } = usePlatform();
  const { session } = useSession();
  const wallet = session?.address;
  const [step, setStep] = useState<StepKey>("resumen");
  const [dir, setDir] = useState(1);

  const [listing, setListing] = useState<Position | null>(null);
  const [price, setPrice] = useState("0");
  const [busy, setBusy] = useState(false);

  const [myListings, setMyListings] = useState<Listing[]>([]);
  useEffect(() => {
    if (!wallet) return;
    fetch(`/api/listings?seller=${encodeURIComponent(wallet)}`)
      .then((res) => (res.ok ? (res.json() as Promise<Listing[]>) : []))
      .then(setMyListings)
      .catch(() => setMyListings([]));
  }, [wallet]);
  const withInterest = myListings.filter(
    (l) => l.status === "interested" && l.interestedWallet,
  );

  useLayerKeys({ onEscape: onClose });
  const panelRef = useFocusTrap<HTMLDivElement>(true);

  function go(next: StepKey) {
    const from = STEPS.findIndex((s) => s.key === step);
    const to = STEPS.findIndex((s) => s.key === next);
    setDir(to > from ? 1 : -1);
    setStep(next);
  }

  // Memoizado de verdad: sin esto, `rows` es un array nuevo en cada render
  // y los useMemo de abajo dependían de una referencia que nunca era
  // estable, así que jamás memoizaban nada.
  const rows = useMemo(
    () =>
      positions
        .map((p) => ({ p, o: getOpportunity(p.opportunitySlug) }))
        .filter((r): r is { p: Position; o: NonNullable<typeof r.o> } => !!r.o),
    [positions, getOpportunity],
  );

  const invertido = rows.reduce((s, r) => s + r.p.principal, 0n);
  const proyectado = rows.reduce(
    (s, r) => s + projectedReturn(r.o, r.p.principal),
    0n,
  );

  const distribucion = useMemo(() => {
    const byStatus = new Map<OpportunityStatus, bigint>();
    for (const { p, o } of rows) {
      byStatus.set(o.status, (byStatus.get(o.status) ?? 0n) + p.principal);
    }
    return Array.from(byStatus.entries()).map(([status, amount]) => ({
      status,
      amount: Number(amount),
    }));
  }, [rows]);

  const proximos = useMemo(
    () =>
      rows
        .map((r) => ({ ...r, m: nextMilestone(r.o) }))
        .filter((r) => r.m && (r.o.status === "active" || r.o.status === "funding")),
    [rows],
  );

  async function confirmarVenta() {
    if (!listing || !wallet) return;
    setBusy(true);
    const priceAmount = usdc(Number(price) || 0);
    // El flag local (`listedPrice`) solo maneja el pill "Publicada" en esta
    // pantalla — la publicación real, la que otros inversionistas pueden
    // ver y marcar interés, vive en position_listings (ver OrderBook).
    await listPosition(listing.id, priceAmount);
    try {
      await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunitySlug: listing.opportunitySlug,
          sellerWallet: wallet,
          amount: listing.principal.toString(),
          price: priceAmount.toString(),
        }),
      });
    } catch {
      // El pill local ya quedó marcado; la publicación real puede reintentarse.
    }
    setBusy(false);
    setListing(null);
  }

  async function refreshMyListings() {
    if (!wallet) return;
    const res = await fetch(`/api/listings?seller=${encodeURIComponent(wallet)}`);
    if (res.ok) setMyListings((await res.json()) as Listing[]);
  }

  return (
    <motion.div
      variants={scrim}
      initial="hidden"
      animate="show"
      exit="exit"
      className="fixed inset-0 z-50 flex flex-col lg:p-6"
      style={{ backgroundColor: "rgba(16,24,40,0.35)" }}
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Mi portafolio"
        variants={dialog}
        initial="hidden"
        animate="show"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
        className="m-auto flex h-full w-full flex-col overflow-hidden border-border shadow-[var(--shadow-lg)] lg:h-[calc(100vh-48px)] lg:w-[min(var(--w-panel),calc(100vw-48px))] lg:rounded-[var(--r-card)] lg:border"
        style={{ backgroundColor: "var(--bg)" }}
      >
        {/* Cabecera */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <h2 className="h1 text-[18px] sm:text-[21px]">Mi portafolio</h2>
            <p className="mt-0.5 text-[12.5px] text-mid">
              {rows.length} {rows.length === 1 ? "posición" : "posiciones"} en tu cuenta
            </p>
          </div>
          <button
            onClick={onClose}
            className="focusable flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border transition-colors hover:bg-surface-soft"
            aria-label="Cerrar el portafolio"
          >
            <X className="h-4 w-4 text-mid" />
          </button>
        </div>

        {/* Pasos */}
        <div
          role="tablist"
          aria-label="Secciones del portafolio"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface px-4 sm:px-6"
        >
          {STEPS.map((s) => {
            const on = step === s.key;
            return (
              <button
                key={s.key}
                role="tab"
                aria-selected={on}
                onClick={() => go(s.key)}
                className="focusable relative shrink-0 whitespace-nowrap px-3 py-3 text-[13px] transition-colors"
                style={{
                  color: on ? "var(--brand-ink)" : "var(--text-mid)",
                  fontWeight: on ? 600 : 400,
                }}
              >
                {s.label}
                {on && (
                  <motion.span
                    layoutId="portfolio-underline"
                    transition={T.indicator}
                    className="absolute inset-x-2 -bottom-px h-[2px] rounded-full"
                    // Era --brand: chartreuse sobre blanco mide 1.13:1, así que
                    // el subrayado no existía. La ficha ya usaba la tinta.
                    style={{ backgroundColor: "var(--brand-ink)" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Contenido */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              variants={slide(dir, 28)}
              initial="hidden"
              animate="show"
              exit="exit"
              className="h-full overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
            >
              {step === "resumen" && (
                <div className="flex flex-col gap-4">
                  {/* Solo aparece si esta wallet aportó al vault desplegado. */}
                  <ClaimPanel />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="card px-4 py-3.5">
                      <Metric label="Capital invertido" value={formatUsdc(invertido)} unit="USDC" size="sm" />
                    </div>
                    <div className="card px-4 py-3.5">
                      <Metric
                        label="Rendimiento proyectado"
                        value={`+${formatUsdc(proyectado)}`}
                        unit="si todo se paga"
                        size="sm"
                        accent="var(--positive)"
                      />
                    </div>
                    <div className="card px-4 py-3.5">
                      <Metric
                        label="Rendimiento medio"
                        value={invertido > 0n ? formatBps(Number((proyectado * 10000n) / invertido), 1) : "—"}
                        unit="sobre capital colocado"
                        size="sm"
                      />
                    </div>
                  </div>

                  {rows.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <section className="card p-5">
                        <h3 className="h3">Distribución por estado</h3>
                        <div className="mt-2">
                          <StatusDonutChart data={distribucion} />
                        </div>
                      </section>
                      <section className="card p-5">
                        <h3 className="h3">Capital invertido en el tiempo</h3>
                        <div className="mt-4">
                          <CapitalOverTimeChart
                            positions={rows.map((r) => r.p)}
                          />
                        </div>
                      </section>
                    </div>
                  )}

                  <section className="card p-5">
                    <h3 className="h3">Próximos hitos</h3>
                    {proximos.length ? (
                      <div className="mt-3 flex flex-col gap-2">
                        {proximos.map(({ p, o, m }) => (
                          <div
                            key={p.id}
                            className="flex items-center gap-3 rounded-[var(--r-panel)] border border-border px-3.5 py-2.5"
                          >
                            <CalendarClock className="h-4 w-4 shrink-0 text-low" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[12.5px] font-medium text-hi">
                                {m!.title}
                              </div>
                              <div className="truncate text-[11.5px] text-low">
                                {o.projectTitle} · {o.company.name}
                              </div>
                            </div>
                            <span className="num shrink-0 text-[12px] font-semibold text-hi">
                              {formatUsdc((o.raisedAmount * BigInt(m!.releaseBps)) / 10000n)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-[12.5px] text-low">
                        No hay hitos pendientes en tus operaciones activas.
                      </p>
                    )}
                  </section>
                </div>
              )}

              {step === "posiciones" && (
                <div className="flex flex-col gap-4">
                {rows.length ? (
                  <div className="flex flex-col gap-3">
                    {rows.map(({ p, o }) => {
                      const ganancia = projectedReturn(o, p.principal);
                      const fallido = o.status === "defaulted" && o.recoveredAmount != null;
                      const recBps = fallido
                        ? waterfallForOpportunity(o, o.recoveredAmount!).investorRecoveryBps
                        : 0;
                      const recuperado = ((p.principal + ganancia) * BigInt(recBps)) / 10000n;
                      const vendible = o.status === "active" || o.status === "funding";

                      return (
                        <div
                          key={p.id}
                          className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
                        >
                          <button
                            type="button"
                            onClick={() => onOpenOpportunity(o.slug)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <span
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] text-[11px] font-bold"
                              style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
                            >
                              {initials(o.company.name)}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[13px] font-semibold text-hi">
                                {o.projectTitle}
                              </div>
                              <div className="truncate text-[11.5px] text-low">
                                {o.company.name} · invertido el {formatDate(p.investedAt)}
                              </div>
                            </div>
                          </button>

                          <div className="flex items-center justify-between gap-3 sm:shrink-0 sm:justify-end">
                            <div className="text-right">
                              <div className="num text-[13px] font-semibold text-hi">
                                {formatUsdc(p.principal)}
                              </div>
                              {fallido ? (
                                <div className="num text-[11px]" style={{ color: "var(--negative)" }}>
                                  {formatUsdc(recuperado)} recuperado
                                </div>
                              ) : (
                                <div className="num text-[11px]" style={{ color: "var(--positive)" }}>
                                  +{formatUsdc(ganancia)}
                                </div>
                              )}
                            </div>

                            <StatusPill status={o.status} />
                          </div>

                          <div className="sm:w-[140px] sm:shrink-0 sm:text-right">
                            {vendible ? (
                              p.listedPrice != null ? (
                                <span className="num text-[11.5px] text-hi">
                                  Publicada · {formatUsdc(p.listedPrice)}
                                </span>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full sm:w-auto"
                                  icon={<TagIcon className="h-3 w-3" />}
                                  onClick={() => {
                                    setListing(p);
                                    setPrice(String(Math.round(Number(p.principal) / 1e6)));
                                  }}
                                >
                                  Vender
                                </Button>
                              )
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    title="Todavía no tienes inversiones"
                    detail="Explora las oportunidades abiertas y coloca tu primer ticket."
                  />
                )}

                {withInterest.length > 0 && (
                  <section className="card p-4">
                    <h3 className="h3">Interesados en tus publicaciones</h3>
                    <p className="mt-1 text-[12.5px] text-mid">
                      Marcar interés no mueve fondos — tú ejecutas la
                      transferencia una vez coordinado el pago.
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      {withInterest.map((l) => {
                        const o = getOpportunity(l.opportunitySlug);
                        if (!o) return null;
                        return (
                          <SellerListingRow
                            key={l.id}
                            listing={l}
                            opportunity={o}
                            sellerWallet={wallet!}
                            onFilled={refreshMyListings}
                          />
                        );
                      })}
                    </div>
                  </section>
                )}
                </div>
              )}

              {step === "movimientos" && (
                <div className="card overflow-hidden">
                  {activity.length ? (
                    activity.map((e) => (
                      <ActivityRow key={e.id} event={e} onOpen={onOpenOpportunity} />
                    ))
                  ) : (
                    <div className="px-5 py-10 text-center text-[12.5px] text-low">
                      Todavía no hay movimientos en tu cuenta.
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      <SellModal
        listing={listing}
        price={price}
        setPrice={setPrice}
        busy={busy}
        onClose={() => setListing(null)}
        onConfirm={confirmarVenta}
      />
    </motion.div>
  );
}

function SellModal({
  listing,
  price,
  setPrice,
  busy,
  onClose,
  onConfirm,
}: {
  listing: Position | null;
  price: string;
  setPrice: (v: string) => void;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={!!listing}
      onClose={onClose}
      title="Publicar posición en el libro de órdenes"
      subtitle="Visible solo para inversionistas verificados"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={busy} onClick={onConfirm}>
            Publicar
          </Button>
        </>
      }
    >
      <Field
        label="Precio de venta"
        suffix="USDC"
        inputMode="decimal"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        hint={
          listing
            ? `Principal de la posición: ${formatUsdc(listing.principal)} USDC`
            : undefined
        }
      />
      <p className="mt-4 text-[12px] leading-relaxed text-low">
        Al concretarse la operación, el contrato transfiere el instrumento al
        comprador únicamente si su wallet figura en el registro de acceso.
      </p>
    </Modal>
  );
}

/**
 * Una fila = un hook `useCreditVault` propio, para respetar las reglas de
 * hooks (no se puede llamarlo condicionalmente dentro de un `.map` en el
 * padre). El vendedor firma `transferPosition` de verdad — es la única
 * transacción real de todo el flujo de mercado secundario; el resto es
 * matching en Postgres.
 */
function SellerListingRow({
  listing,
  opportunity,
  sellerWallet,
  onFilled,
}: {
  listing: {
    id: string;
    amount: string;
    price: string;
    interestedWallet: string | null;
  };
  opportunity: Opportunity;
  sellerWallet: Address;
  onFilled: () => void;
}) {
  const vault = useCreditVault(
    sellerWallet,
    opportunity.vaultAddress ? { address: opportunity.vaultAddress } : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transfer() {
    if (!listing.interestedWallet || !vault.address) return;
    setBusy(true);
    setError(null);
    try {
      const hash = await vault.transferPosition(
        listing.interestedWallet as Address,
        BigInt(listing.amount),
      );
      await fetch(`/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fill",
          sellerWallet,
          txHash: hash,
        }),
      });
      onFilled();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "La transacción no pudo confirmarse",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[var(--r-panel)] border border-border px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="truncate text-[12.5px] font-semibold text-hi">
            {opportunity.projectTitle}
          </div>
          <div className="num text-[11.5px] text-low">
            {formatUsdc(BigInt(listing.amount))} USDC · interesado{" "}
            {listing.interestedWallet?.slice(0, 6)}…{listing.interestedWallet?.slice(-4)}
          </div>
        </div>
        <Button
          size="sm"
          icon={<Send className="h-3 w-3" />}
          loading={busy}
          disabled={!opportunity.vaultAddress}
          onClick={transfer}
        >
          Transferir
        </Button>
      </div>
      {!opportunity.vaultAddress && (
        <p className="text-[11px]" style={{ color: "var(--negative)" }}>
          Esta oportunidad todavía no tiene vault desplegado.
        </p>
      )}
      {error && (
        <p className="text-[11px]" style={{ color: "var(--negative)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
