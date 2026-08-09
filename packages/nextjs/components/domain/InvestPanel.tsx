"use client";

import { useState } from "react";
import type { Address } from "viem";
import { motion } from "motion/react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Row } from "@/components/ui/Stat";
import { Waiting } from "@/components/ui/Waiting";
import { usePlatform } from "@/lib/data/store";
import { daysUntil, formatBps, formatRatio, formatUsdc, usdc } from "@/lib/format";
import { T } from "@/lib/motion";
import {
  coverageBps,
  fundingBps,
  isOpenForFunding,
  projectedReturn,
  remainingToFund,
} from "@/lib/opportunity";
import { computeScore } from "@/lib/underwriting";
import { protocolChain } from "@/lib/web3/config";
import { getBlockExplorerTxLink } from "@/utils/scaffold-stylus/networks";
import { useSession } from "@/lib/useSession";
import { useCreditRegistry } from "@/hooks/useCreditRegistry";
import { useCreditVault } from "@/hooks/useCreditVault";
import { useProtocolToken } from "@/hooks/useProtocolToken";
import type { Opportunity } from "@/lib/types";

const RAPIDOS = [1_000, 2_500, 5_000];

export function InvestPanel({
  o,
  onOpenFunds,
  onRequestAccess,
  onOpenPortfolio,
}: {
  o: Opportunity;
  /** Entrada contextual al flujo de agregar fondos, desde el error de saldo. */
  onOpenFunds?: () => void;
  /** Salida del bloqueo de verificación: abre la cuenta en el formulario de
   *  acceso. Sin esto el bloqueo era un texto rojo sin puerta. */
  onRequestAccess?: () => void;
  /** Final del flujo: la inversión termina en el portafolio, no en un
   *  diálogo descartado. */
  onOpenPortfolio?: () => void;
}) {
  const { balance, invest } = usePlatform();
  const { session } = useSession();
  const investor = session?.address as Address | undefined;
  const vault = useCreditVault(
    investor,
    o.vaultAddress ? { address: o.vaultAddress } : null,
  );
  const registry = useCreditRegistry(vault.address);
  const token = useProtocolToken(investor, vault.address);
  const verified = session?.verified ?? false;
  // Vacío, no "2500": precargado, la cadena de errores se evaluaba al abrir
  // la ficha y lo primero que veía un usuario nuevo era texto rojo.
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  /**
   * Qué firma está corriendo. Invertir son DOS transacciones —autorizar
   * el gasto del token y enviar el aporte al contrato— y hasta ahora eso
   * lo contaba, mal y en inglés, el modal de Privy que se interponía
   * antes de cada una. Apagado ese modal (ver Web3Provider), sin esta
   * línea la persona aprieta "Confirmar" y se queda mirando un botón
   * ocupado entre diez y treinta segundos, sin saber si se colgó.
   */
  const [paso, setPaso] = useState<"autorizando" | "enviando" | null>(null);
  const [receipt, setReceipt] = useState<InvestReceipt | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);

  const open = isOpenForFunding(o);
  const parsed = Number(amount.replace(/[^0-9.]/g, "")) || 0;
  const value = usdc(parsed);
  const left = remainingToFund(o);
  const days = daysUntil(o.fundingDeadline);
  const score = computeScore(o);
  const cov = coverageBps(o);

  const availableBalance = token.balance ?? balance;
  const protocolLoading = vault.isLoading || registry.isLoading || token.isLoading;

  /* ---------------------------------------------------------------------
     Tres clases de bloqueo, en el orden en que le importan a la persona:
     elegibilidad, luego infraestructura, luego el monto. Antes iban todas
     revueltas en una sola cadena con `!verified` al final, así que a un
     usuario sin verificar y con saldo bajo se le decía "Saldo insuficiente"
     y se le ofrecía agregar fondos — que no lo desbloqueaba.
     --------------------------------------------------------------------- */

  // 1. Elegibilidad. No la arregla ningún monto: es una puerta, no un error
  //    de campo, y tiene su propia salida.
  const accessBlocked = !verified;

  // 2. Infraestructura. Cuatro estados técnicos distintos que a la persona
  //    le dicen lo mismo: todavía no se puede operar. Una frase, y el
  //    detalle a un clic para quien lo necesite.
  const infraDetail = !vault.address || !token.address
    ? "El protocolo no está desplegado en esta red."
    : protocolLoading
      ? "Consultando el estado onchain."
      : !registry.isVaultRegistered
        ? "El vault de esta operación no está registrado en el CreditRegistry."
        : vault.status !== 1
          ? "El vault no está en estado de fondeo."
          : null;
  const infraBlocked = infraDetail !== null;

  // 3. El monto. Solo esto es un error del campo.
  const amountError =
    parsed <= 0
      ? null
      : parsed < 1000
        ? "El ticket mínimo es 1,000 USDC"
        : value > left
          ? `Quedan ${formatUsdc(left)} USDC por colocar en esta ronda`
          : value > availableBalance
            ? "Saldo insuficiente"
            : null;

  const canInvest =
    open && !accessBlocked && !infraBlocked && parsed > 0 && !amountError;

  /** El techo real de este ticket: lo que falta por colocar, o lo que hay
   *  en la wallet si es menos. Estaba calculado y no se ofrecía. */
  const maxTicket = availableBalance < left ? availableBalance : left;

  async function handleInvest() {
    setBusy(true);
    setTransactionError(null);
    const balanceBefore = availableBalance;
    try {
      if ((token.allowance ?? 0n) < value) {
        setPaso("autorizando");
        await token.approve(value);
      }
      setPaso("enviando");
      const tx = await vault.fund(value);
      // El store conserva únicamente la proyección visual del catálogo.
      // La operación financiera ya fue confirmada onchain antes de tocarlo.
      await invest(o.slug, value);
      setConfirming(false);
      setReceipt({
        amount: value,
        hash: tx?.transactionHash ?? null,
        balanceBefore,
      });
      setAmount("");
    } catch (cause) {
      setConfirming(false);
      setTransactionError(
        cause instanceof Error ? cause.message : "La transacción no pudo confirmarse",
      );
    } finally {
      setBusy(false);
      setPaso(null);
    }
  }

  return (
    <>
      <aside className="card overflow-hidden lg:sticky lg:top-[76px]">
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
              <span>
                <span className="num">{days}</span> días restantes
              </span>
            )}
          </div>
        </div>

        {open ? (
          <div className="p-5">
            {/* La puerta regulatoria, antes que cualquier campo. Es un
                titular y una salida: el párrafo que explicaba por qué
                explorar es libre y comprometer capital no se fue —quien ve
                este bloque no necesita la doctrina, necesita el botón. */}
            {accessBlocked && (
              <div className="mb-4 rounded-[var(--r-panel)] border border-border p-4">
                <div className="text-[13px] font-semibold text-hi">
                  {session?.accessStatus === 1
                    ? "Tu solicitud de acceso está en revisión"
                    : "Necesitas acceso aprobado para invertir"}
                </div>
                {onRequestAccess && session?.accessStatus !== 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={onRequestAccess}
                  >
                    Solicitar acceso
                  </Button>
                )}
              </div>
            )}

            {/* Infraestructura: el hecho y su motivo, sin desplegable. El
                "Ver detalle técnico" era un control extra para leer una
                línea que cabía debajo del titular. */}
            {!accessBlocked && infraBlocked && (
              <div className="mb-4 rounded-[var(--r-panel)] border border-border p-4">
                <div className="text-[13px] font-semibold text-hi">
                  Esta operación todavía no acepta capital
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-low">
                  {infraDetail}
                </p>
              </div>
            )}

            {/* Los dos números de los que depende la decisión, fijados junto
                al campo. Vivían en las pestañas 2 y 4: para decidir había
                que sostener "1.62x" y "B · 720" en la cabeza mientras se
                tecleaba en un panel que no mostraba ninguno. */}
            <div className="mb-3.5 flex items-stretch gap-2">
              <div className="flex-1 rounded-[var(--r-panel)] border border-border px-3 py-2">
                <div className="label">Calificación</div>
                <div className="num mt-0.5 text-[15px] font-semibold text-hi">
                  {score.grade} · {score.score}
                </div>
              </div>
              <div className="flex-1 rounded-[var(--r-panel)] border border-border px-3 py-2">
                <div className="label">Cobertura</div>
                <div
                  className="num mt-0.5 text-[15px] font-semibold"
                  style={{
                    color: cov >= 10000 ? "var(--positive)" : "var(--negative)",
                  }}
                >
                  {formatRatio(cov)}
                  {cov < 10000 && (
                    <span className="ml-1.5 font-sans text-[11px] font-medium">
                      insuficiente
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Field
              label="Monto a invertir"
              suffix="USDC"
              inputMode="decimal"
              placeholder="2,500"
              value={amount}
              disabled={accessBlocked || infraBlocked}
              onChange={(e) => setAmount(e.target.value)}
              error={transactionError ?? amountError}
              hint={`Disponible onchain: ${formatUsdc(availableBalance)} USDC`}
            />

            {amountError === "Saldo insuficiente" && onOpenFunds && (
              <button
                onClick={onOpenFunds}
                className="focusable mt-1.5 text-[11.5px] font-medium underline decoration-dotted"
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
                  disabled={accessBlocked || infraBlocked}
                  className="focusable num flex-1 rounded-[var(--r-input)] border border-border bg-surface py-1.5 text-[12px] text-mid transition-colors hover:border-[var(--brand-ink)] hover:text-[var(--brand-ink)] disabled:opacity-40"
                >
                  {q.toLocaleString("es-PE")}
                </button>
              ))}
              {/* El techo del ticket ya estaba calculado y nunca se ofrecía. */}
              <button
                onClick={() => setAmount(String(Math.floor(Number(maxTicket) / 1e6)))}
                disabled={accessBlocked || infraBlocked || maxTicket <= 0n}
                className="focusable flex-1 rounded-[var(--r-input)] border border-border bg-surface py-1.5 text-[12px] font-medium text-mid transition-colors hover:border-[var(--brand-ink)] hover:text-[var(--brand-ink)] disabled:opacity-40"
              >
                Máximo
              </button>
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
            >
              Invertir ahora
            </Button>

            <div className="mt-3 text-[11px] text-low">
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
            {/* Cancelar deja de estar disponible una vez que la primera
                firma salió: la transacción ya está en la red y el botón
                no la detendría — solo cerraría la pantalla que dice qué
                está pasando. */}
            <Button
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
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
        {/* Calificación y cobertura viajan hasta la confirmación: son los dos
            datos que sostienen la decisión y faltaban justo acá. */}
        <Row label="Calificación" value={`${score.grade} · ${score.score}`} />
        <Row
          label="Cobertura de la garantía"
          value={formatRatio(cov)}
          accent={cov >= 10000 ? "var(--positive)" : "var(--negative)"}
        />
        <Row
          label="Ganancia estimada"
          value={`+${formatUsdc(projectedReturn(o, value), 2)} USDC`}
          accent="var(--positive)"
          strong
        />
        {/* Antes de firmar, el riesgo. Mientras se firma, el progreso.
            No conviven: la advertencia de liquidez es para decidir, y esa
            decisión ya se tomó cuando aparece el primer paso. */}
        {paso === null ? (
          /* Advertencia de liquidez, no explicación del mercado secundario:
             el párrafo de cuatro líneas que describía cómo funciona el libro
             de órdenes se fue. Lo que hay que saber antes de firmar es que el
             capital puede quedar inmovilizado, y eso cabe en una línea. */
          <p className="mt-4 rounded-[var(--r-panel)] border border-border px-3 py-2.5 text-[11.5px] leading-relaxed text-mid">
            Sin comprador en el mercado secundario, el capital queda
            inmovilizado hasta que la operación pague.
          </p>
        ) : (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 flex flex-col gap-2 rounded-[var(--r-panel)] border border-border px-3 py-2.5"
          >
            <span className="text-[12.5px] font-medium text-hi">
              {paso === "autorizando"
                ? "Paso 1 de 2 — autorizando el uso de tu saldo"
                : "Paso 2 de 2 — enviando tu aporte al contrato"}
            </span>
            <Waiting
              label={
                paso === "autorizando"
                  ? "Autorizando el uso de tu saldo"
                  : "Enviando tu aporte al contrato"
              }
              width={110}
            />
            <span className="text-[11.5px] leading-relaxed text-low">
              Son dos firmas en Arbitrum y tardan lo que tarde la red. No
              cierres esta pantalla.
            </span>
          </div>
        )}
      </Modal>

      {/* El momento en que se mueve el dinero. Antes terminaba en una frase
          y un botón "Entendido", mientras recargar saldo de demostración se
          llevaba el spring y el conteo de la cifra — el gesto grande estaba
          en el acto pequeño. Y no terminaba en ningún lado: volvías a la
          misma ficha con el mismo monto. Ahora termina en el portafolio. */}
      <Modal
        open={receipt !== null}
        onClose={() => setReceipt(null)}
        title="Capital en custodia contractual"
        subtitle={`${o.projectTitle} — ${o.company.name}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReceipt(null)}>
              Seguir explorando
            </Button>
            {onOpenPortfolio && (
              <Button
                onClick={() => {
                  setReceipt(null);
                  onOpenPortfolio();
                }}
              >
                Ver mi posición
              </Button>
            )}
          </>
        }
      >
        {receipt && (
          <div className="flex flex-col items-center text-center">
            {/* El candado dentro de un círculo chartreuse era el gesto de
                confirmación, y el spring del sistema estaba puesto en él.
                La cifra es el hecho: ahora el spring entra con el monto, que
                es lo que la persona vino a ver. */}
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={T.spring}
              className="num text-[36px] font-bold tracking-[-0.02em] text-hi"
            >
              {formatUsdc(receipt.amount)}
              <span className="ml-1 text-[15px] font-semibold text-mid">
                USDC
              </span>
            </motion.div>
            <p className="mt-1 text-[12.5px] text-mid">
              retenidos en el contrato, no en la empresa
            </p>

            {/* El saldo bajando. Es lo que hace sentir que hay una cuenta
                viva detrás — y era el recurso que el sistema declaraba su
                firma y nunca usaba donde importa. */}
            <div className="mt-5 w-full rounded-[var(--r-panel)] border border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-mid">Tu saldo disponible</span>
                <span className="num text-[14px] font-semibold text-hi">
                  <AnimatedNumber
                    value={availableBalance}
                    from={receipt.balanceBefore}
                    decimals={2}
                    suffix=" USDC"
                  />
                </span>
              </div>
            </div>

            {/* Acá había un párrafo repitiendo cómo funcionan los hitos y la
                prelación. Es la tercera vez que se lo cuenta a la misma
                persona —onboarding, pestañas de la ficha, y esto— y ya
                invirtió: lo que corresponde es la prueba de que pasó. */}
            {receipt.hash && <ExplorerLink hash={receipt.hash} />}
          </div>
        )}
      </Modal>
    </>
  );
}

type InvestReceipt = {
  amount: bigint;
  hash: string | null;
  balanceBefore: bigint;
};

/** La prueba de que ocurrió: el hash, y el enlace al explorador cuando la
 *  red tiene uno (el devnet local no). */
function ExplorerLink({ hash }: { hash: string }) {
  const url = getBlockExplorerTxLink(protocolChain.id, hash);
  const short = `${hash.slice(0, 10)}…${hash.slice(-8)}`;

  if (!url) {
    return (
      <p className="num mt-4 text-[11px] text-low">
        Transacción {short}
      </p>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="focusable num mt-4 inline-flex items-center text-[11.5px] font-medium underline decoration-dotted"
      style={{ color: "var(--brand-ink)" }}
    >
      Ver la transacción {short}
    </a>
  );
}
