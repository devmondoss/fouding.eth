"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, Tag as TagIcon, X } from "lucide-react";
import { ActivityRow } from "@/components/domain/ActivityRow";
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
import { usePlatform } from "@/lib/data/store";
import { formatBps, formatDate, formatUsdc, usdc } from "@/lib/format";
import { nextMilestone, projectedReturn } from "@/lib/opportunity";
import { waterfallForOpportunity } from "@/lib/underwriting";
import type { OpportunityStatus, Position } from "@/lib/types";

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
  const [step, setStep] = useState<StepKey>("resumen");
  const [dir, setDir] = useState(1);

  const [listing, setListing] = useState<Position | null>(null);
  const [price, setPrice] = useState("0");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
    if (!listing) return;
    setBusy(true);
    await listPosition(listing.id, usdc(Number(price) || 0));
    setBusy(false);
    setListing(null);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: "rgba(16,24,40,0.35)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.28, ease: [0.22, 0.9, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="m-auto flex h-[calc(100vh-48px)] w-[min(980px,calc(100vw-48px))] flex-col overflow-hidden rounded-[var(--r-card)] border border-border shadow-[var(--shadow-lg)]"
        style={{ backgroundColor: "var(--bg)" }}
      >
        {/* Cabecera */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-6 py-4">
          <div>
            <h2 className="h1 text-[21px]">Mi portafolio</h2>
            <p className="mt-0.5 text-[12.5px] text-mid">
              {rows.length} {rows.length === 1 ? "posición" : "posiciones"} en tu cuenta
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border transition-colors hover:bg-surface-soft"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4 text-mid" />
          </button>
        </div>

        {/* Pasos */}
        <div className="flex shrink-0 gap-1 border-b border-border bg-surface px-6">
          {STEPS.map((s) => {
            const on = step === s.key;
            return (
              <button
                key={s.key}
                onClick={() => go(s.key)}
                className="relative px-3 py-3 text-[13px] transition-colors"
                style={{
                  color: on ? "var(--brand-ink)" : "var(--text-mid)",
                  fontWeight: on ? 600 : 400,
                }}
              >
                {s.label}
                {on && (
                  <motion.span
                    layoutId="portfolio-underline"
                    className="absolute inset-x-2 -bottom-px h-[2px] rounded-full"
                    style={{ backgroundColor: "var(--brand)" }}
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
              initial={{ opacity: 0, x: dir * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -28 }}
              transition={{ duration: 0.26, ease: [0.22, 0.9, 0.3, 1] }}
              className="h-full overflow-y-auto px-6 py-5"
            >
              {step === "resumen" && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-3 gap-3">
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
                    <div className="grid grid-cols-2 gap-3">
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

              {step === "posiciones" &&
                (rows.length ? (
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
                        <div key={p.id} className="card flex items-center gap-4 p-4">
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

                          <div className="shrink-0 text-right">
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

                          <div className="shrink-0">
                            <StatusPill status={o.status} />
                          </div>

                          <div className="w-[140px] shrink-0 text-right">
                            {vendible ? (
                              p.listedPrice != null ? (
                                <span className="num text-[11.5px] text-hi">
                                  Publicada · {formatUsdc(p.listedPrice)}
                                </span>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  icon={<TagIcon className="h-3 w-3" />}
                                  onClick={() => {
                                    setListing(p);
                                    setPrice(String(Math.round(Number(p.principal) / 1e6)));
                                  }}
                                >
                                  Vender
                                </Button>
                              )
                            ) : (
                              <span className="text-[11.5px] text-low">—</span>
                            )}
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
                ))}

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
