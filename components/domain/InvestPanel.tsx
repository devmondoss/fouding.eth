"use client";

import { useState } from "react";
import { ArrowRight, Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Row } from "@/components/ui/Stat";
import { usePlatform } from "@/lib/data/store";
import { daysUntil, formatBps, formatUsdc, usdc } from "@/lib/format";
import {
  fundingBps,
  isOpenForFunding,
  projectedReturn,
  remainingToFund,
} from "@/lib/opportunity";
import { UNVERIFIED_TICKET_CAP, useSession } from "@/lib/useSession";
import type { Opportunity } from "@/lib/types";

const RAPIDOS = [1_000, 2_500, 5_000];

export function InvestPanel({
  o,
  onOpenFunds,
}: {
  o: Opportunity;
  /** Entrada contextual al flujo de agregar fondos, desde el error de saldo. */
  onOpenFunds?: () => void;
}) {
  const { balance, invest } = usePlatform();
  const { session } = useSession();
  const verified = session?.verified ?? false;
  const [amount, setAmount] = useState("2500");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const open = isOpenForFunding(o);
  const parsed = Number(amount.replace(/[^0-9.]/g, "")) || 0;
  const value = usdc(parsed);
  const left = remainingToFund(o);
  const days = daysUntil(o.fundingDeadline);

  const error =
    parsed <= 0
      ? null
      : value > balance
        ? "Saldo insuficiente"
        : value > left
          ? `Máximo disponible: ${formatUsdc(left)} USDC`
          : parsed < 1000
            ? "El ticket mínimo es 1,000 USDC"
            : !verified && parsed > UNVERIFIED_TICKET_CAP
              ? `Verifica tu identidad para invertir más de ${formatUsdc(usdc(UNVERIFIED_TICKET_CAP))} USDC`
              : null;

  const canInvest = open && parsed > 0 && !error;

  async function handleInvest() {
    setBusy(true);
    await invest(o.slug, value);
    setBusy(false);
    setConfirming(false);
    setDone(true);
  }

  return (
    <>
      <aside className="card sticky top-[76px] overflow-hidden">
        {/* Recaudación */}
        <div className="border-b border-border p-5">
          <div className="flex items-baseline justify-between">
            <span className="num text-[22px] font-bold text-hi">
              {formatUsdc(o.raisedAmount)}
            </span>
            <span className="num text-[13px] text-mid">
              {formatBps(fundingBps(o), 0)}
            </span>
          </div>
          <div className="mt-1 text-[12.5px] text-low">
            recaudado de {formatUsdc(o.targetAmount)} USDC
          </div>
          <div className="mt-2.5">
            <ProgressBar bps={fundingBps(o)} />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[12px] text-mid">
            <span>{o.investorCount} inversionistas</span>
            {open && days > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {days} días restantes
              </span>
            )}
          </div>
        </div>

        {open ? (
          <div className="p-5">
            <Field
              label="Monto a invertir"
              suffix="USDC"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              error={error}
              hint={`Disponible: ${formatUsdc(balance)} USDC`}
            />

            {error === "Saldo insuficiente" && onOpenFunds && (
              <button
                onClick={onOpenFunds}
                className="mt-1.5 text-[11.5px] font-medium underline decoration-dotted"
                style={{ color: "var(--brand-ink)" }}
              >
                Agregar fondos
              </button>
            )}

            <div className="mt-2.5 flex gap-2">
              {RAPIDOS.map((q) => (
                <button
                  key={q}
                  onClick={() => setAmount(String(q))}
                  className="num flex-1 rounded-[var(--r-input)] border border-border bg-surface py-1.5 text-[12px] text-mid transition-colors hover:border-[var(--brand-ink)] hover:text-[var(--brand-ink)]"
                >
                  {q.toLocaleString("es-PE")}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <Row
                label={`Rentabilidad · ${o.termMonths}m`}
                value={formatBps(o.apyBps)}
              />
              <Row
                label="Ganancia estimada"
                value={`+${formatUsdc(projectedReturn(o, value), 2)}`}
                accent="var(--positive)"
                strong
              />
              <Row
                label="Total al vencimiento"
                value={`${formatUsdc(value + projectedReturn(o, value), 2)} USDC`}
              />
            </div>

            <Button
              className="mt-4 w-full"
              size="lg"
              disabled={!canInvest}
              onClick={() => setConfirming(true)}
              iconRight={<ArrowRight className="h-4 w-4" />}
            >
              Invertir ahora
            </Button>

            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-low">
              <Lock className="h-3 w-3 shrink-0" />
              En custodia contractual hasta cumplir cada hito
            </div>
          </div>
        ) : (
          <div className="p-5">
            <div className="text-[13px] font-semibold text-hi">
              Ronda cerrada
            </div>
            <p className="mt-1.5 text-[12.5px] text-mid">
              Esta operación ya no recibe capital.
            </p>
          </div>
        )}
      </aside>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Confirmar inversión"
        subtitle={`${o.projectTitle} — ${o.company.name}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button loading={busy} onClick={handleInvest}>
              Confirmar {formatUsdc(value)} USDC
            </Button>
          </>
        }
      >
        <Row label="Monto" value={`${formatUsdc(value)} USDC`} />
        <Row label="Rentabilidad" value={formatBps(o.apyBps)} />
        <Row label="Plazo" value={`${o.termMonths} meses`} />
        <Row
          label="Ganancia estimada"
          value={`+${formatUsdc(projectedReturn(o, value), 2)} USDC`}
          accent="var(--positive)"
          strong
        />
        <div className="mt-4 rounded-[var(--r-panel)] border border-border px-3 py-2.5">
          <p className="text-[12px] font-medium text-hi">
            Mercado secundario restringido, no garantizado
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-low">
            Puedes publicar tu posición en el libro de órdenes antes del
            vencimiento, pero solo otras wallets verificadas pueden comprarla
            y no hay garantía de encontrar comprador. Sin eso, el capital
            queda inmovilizado hasta que la operación pague.
          </p>
        </div>
      </Modal>

      <Modal
        open={done}
        onClose={() => setDone(false)}
        title="Inversión registrada"
        subtitle="El capital quedó bajo custodia contractual"
        footer={<Button onClick={() => setDone(false)}>Entendido</Button>}
      >
        <p className="text-[13px] leading-relaxed text-mid">
          Posición emitida por{" "}
          <span className="num font-semibold text-hi">
            {formatUsdc(value)} USDC
          </span>
          .
        </p>
      </Modal>
    </>
  );
}
