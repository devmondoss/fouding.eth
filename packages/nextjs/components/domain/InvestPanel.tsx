"use client";

import { useState, type ReactNode } from "react";
import type { Address } from "viem";
import { motion } from "motion/react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Row } from "@/components/ui/Stat";
import { Waiting } from "@/components/ui/Waiting";
import { ProyeccionTicket } from "@/components/domain/ProyeccionTicket";
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
import { mensajeDeCadena } from "@/lib/web3/errors";
import { getBlockExplorerTxLink } from "@/utils/scaffold-stylus/networks";
import { useSession } from "@/lib/useSession";
import { useCreditRegistry } from "@/hooks/useCreditRegistry";
import { useCreditVault } from "@/hooks/useCreditVault";
import { useProtocolToken } from "@/hooks/useProtocolToken";
import type { Opportunity } from "@/lib/types";

const RAPIDOS = [1_000, 2_500, 5_000];

/** Piso del ticket. Estaba escrito a mano dentro del mensaje de error y en
 *  ningún lado más: la barra lo anuncia antes de que alguien lo descubra
 *  tecleando 500 y recibiendo un texto rojo. */
const TICKET_MINIMO = 1_000;

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
  // Arranca vacío y se llena al abrir la hoja (ver `montoSugerido`). Vive
  // acá arriba y no dentro de la hoja para que el monto sobreviva a
  // cerrarla: quien la abre, teclea 7,500, sale a mirar la garantía y
  // vuelve, encuentra sus 7,500 y no un campo en blanco.
  const [amount, setAmount] = useState("");
  /** La hoja donde se arma y se firma el ticket. Antes eran dos estados —el
   *  campo vivía en la barra y `confirming` abría un diálogo que repetía sus
   *  cifras—; ahora el acto entero cabe en una capa. */
  const [hoja, setHoja] = useState(false);
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
      : parsed < TICKET_MINIMO
        ? `El ticket mínimo es ${TICKET_MINIMO.toLocaleString("es-PE")} USDC`
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

  const proyeccionInteres = projectedReturn(o, value);

  /**
   * Con qué monto se abre la hoja.
   *
   * Antes abría vacía y la proyección se dibujaba sobre un ticket de
   * referencia inventado: una gráfica que no era la de nadie, con una nota
   * al costado pidiendo disculpas por serlo. La hoja se abre con una cifra
   * real —el ticket estándar, o el techo que el saldo y la ronda permitan si
   * es menor— y desde el primer instante todo lo que se ve, la curva
   * incluida, describe ESA plata. Cambiarla es teclear encima.
   */
  const montoSugerido = Math.max(
    TICKET_MINIMO,
    Math.min(RAPIDOS[1], Math.floor(Number(maxTicket) / 1e6)),
  );

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
      setHoja(false);
      setReceipt({
        amount: value,
        hash: tx?.transactionHash ?? null,
        balanceBefore,
      });
      setAmount("");
    } catch (cause) {
      // La hoja NO se cierra: el error va al campo del monto, que es donde
      // se puede hacer algo con él. Cerrarla dejaba a la persona en la ficha
      // sin saber si su dinero salió o no.
      setTransactionError(
        // Mismo filtro que la recarga: acá también terminaba impreso el
        // volcado de viem, en inglés y con la dirección completa, dentro
        // del campo del monto (ver lib/web3/errors.ts).
        mensajeDeCadena(cause, "La transacción no pudo confirmarse."),
      );
    } finally {
      setBusy(false);
      setPaso(null);
    }
  }

  /** Lo que interrumpe el ticket, si algo lo interrumpe. Los tres casos
   *  dicen lo mismo —hoy no se puede poner capital— y solo cambian el
   *  motivo y la salida, así que ocupan un único lugar en la barra en vez
   *  de apilarse encima del campo. */
  const bloqueo = !open
    ? {
        titulo: "Ronda cerrada",
        detalle: "Esta operación ya no recibe capital.",
        accion: null,
      }
    : accessBlocked
      ? {
          titulo:
            session?.accessStatus === 1
              ? "Tu solicitud de acceso está en revisión"
              : "Necesitas acceso aprobado para invertir",
          detalle: "Explorar la operación es libre; comprometer capital no.",
          accion:
            onRequestAccess && session?.accessStatus !== 1 ? (
              <Button size="sm" variant="outline" onClick={onRequestAccess}>
                Solicitar acceso
              </Button>
            ) : null,
        }
      : infraBlocked
        ? {
            titulo: "Esta operación todavía no acepta capital",
            detalle: infraDetail,
            accion: null,
          }
        : null;

  return (
    <>
      {/* La inversión era una columna de 320px al costado: una segunda
          página en paralelo a la ficha, con su propio encabezado de
          recaudación, sus dos cuadros y sus tres filas. Dos documentos
          compitiendo por la misma mirada, y la ficha —lo que hay que leer
          para decidir— leyendo en 900px de los 1240 disponibles.
          Acá es una barra: se cruza una vez, de izquierda a derecha, y en
          ese orden están las tres cosas que hacen falta —cómo va el fondeo,
          cuánto pongo, qué recibo— con el botón al final del recorrido. */}
      <section
        aria-label="Invertir en esta operación"
        className="shrink-0 border-b border-border bg-surface"
      >
        <div className="flex flex-col lg:flex-row lg:items-stretch">
          {/* Cómo va el fondeo */}
          <Grupo className="lg:w-[300px]">
            <div className="flex items-baseline gap-2">
              <span className="num text-[19px] font-bold leading-none text-hi">
                {formatUsdc(o.raisedAmount)}
              </span>
              <span className="text-[11.5px] text-low">
                de {formatUsdc(o.targetAmount)} USDC
              </span>
              <span className="num ml-auto text-[12.5px] font-medium text-mid">
                {formatBps(fundingBps(o), 0)}
              </span>
            </div>
            <div className="mt-2">
              <ProgressBar bps={fundingBps(o)} height={5} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[11.5px] text-mid">
              <span>{o.investorCount} inversionistas</span>
              {open && days > 0 && (
                <span>
                  <span className="num">{days}</span> días restantes
                </span>
              )}
            </div>

            {/* Los dos números de los que depende la decisión viven en la
                cabecera de la ficha, junto al nombre de quien pide. Ahí no
                caben por debajo de md, y sin ellos el ticket se teclea a
                ciegas: acá vuelven, en una línea. */}
            <div className="mt-2.5 flex items-baseline gap-4 border-t border-border pt-2 md:hidden">
              <span className="text-[11.5px] text-low">
                Calificación{" "}
                <span className="num font-semibold text-hi">
                  {score.grade} · {score.score}
                </span>
              </span>
              <span className="text-[11.5px] text-low">
                Cobertura{" "}
                <span
                  className="num font-semibold"
                  style={{
                    color: cov >= 10000 ? "var(--positive)" : "var(--negative)",
                  }}
                >
                  {formatRatio(cov)}
                </span>
              </span>
            </div>
          </Grupo>

          {bloqueo ? (
            <Grupo className="lg:flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-hi">
                    {bloqueo.titulo}
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-low">
                    {bloqueo.detalle}
                  </p>
                </div>
                {bloqueo.accion}
              </div>
            </Grupo>
          ) : (
            <>
              {/* Las condiciones del crédito. El campo del monto ya no vive
                  acá: teclear una cifra es el principio de una decisión, no
                  un dato de la operación, y mientras estuvo en la barra
                  obligaba a decidir antes de haber leído el expediente. La
                  barra dice qué se ofrece; el ticket se arma al apretar. */}
              <Grupo className="lg:flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2.5">
                  <Condicion label="Rentabilidad fija" value={formatBps(o.apyBps)} />
                  <Condicion label="Plazo" value={`${o.termMonths} meses`} />
                  <Condicion
                    label="Ticket mínimo"
                    value={`${TICKET_MINIMO.toLocaleString("es-PE")} USDC`}
                  />
                </div>
              </Grupo>

              {/* La acción */}
              <Grupo className="lg:w-[300px]">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    if (!amount) setAmount(String(montoSugerido));
                    setHoja(true);
                  }}
                >
                  Invertir ahora
                </Button>
                <div className="mt-2 text-[11px] leading-snug text-low">
                  En custodia contractual hasta cumplir cada hito
                </div>
              </Grupo>
            </>
          )}
        </div>
      </section>

      {/* La hoja de inversión.
       *
       * Antes había dos capas entre el botón y el dinero: se tecleaba el
       * monto en la barra y después un diálogo repetía en seis filas lo que
       * ya estaba a la vista para pedir confirmación. Dos pantallas para un
       * acto. Acá es una: se arma el ticket, se ve a dónde llega y se firma
       * en el mismo lugar — y la única capa que sigue es el recibo, que es
       * la otra mitad del hecho y no un paso más del formulario. */}
      <Modal
        open={hoja}
        onClose={() => !busy && setHoja(false)}
        title="Invertir en esta operación"
        subtitle={`${o.projectTitle} — ${o.company.name}`}
        width={620}
        footer={
          <>
            {/* Cancelar deja de estar disponible una vez que la primera
                firma salió: la transacción ya está en la red y el botón
                no la detendría — solo cerraría la pantalla que dice qué
                está pasando. */}
            <Button
              variant="ghost"
              onClick={() => setHoja(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button loading={busy} disabled={!canInvest} onClick={handleInvest}>
              {parsed > 0
                ? `Confirmar ${formatUsdc(value)} USDC`
                : "Confirmar inversión"}
            </Button>
          </>
        }
      >
        {/* Dos columnas de igual peso y una regla entre ellas: lo que pones
            a la izquierda, lo que devuelve a la derecha. Apilado, con las
            cifras envolviendo donde alcanzaran, no se leía como una relación
            sino como una lista de datos sueltos. */}
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <div>
            <Field
              label="Monto a invertir"
              suffix="USDC"
              inputMode="decimal"
              placeholder={RAPIDOS[1].toLocaleString("es-PE")}
              value={amount}
              disabled={busy}
              onChange={(e) => setAmount(e.target.value)}
              error={transactionError ?? amountError}
              // El símbolo sale del token, no de una constante: lo que hay en
              // la wallet en esta red es mUSDC, y llamarlo "USDC" a secas
              // sería presentar el token de prueba como el de Circle
              // (PRODUCT.md §Evidence). La meta y el ticket sí hablan en USDC
              // porque son el dinero de la operación, no el saldo.
              hint={`Disponible onchain: ${formatUsdc(availableBalance)} ${token.symbol}`}
            />

            <div className="mt-2.5 grid grid-cols-4 gap-1.5">
              {RAPIDOS.map((q) => (
                <Rapido
                  key={q}
                  disabled={busy}
                  activo={parsed === q}
                  onClick={() => setAmount(String(q))}
                >
                  <span className="num">{q.toLocaleString("es-PE")}</span>
                </Rapido>
              ))}
              {/* El techo del ticket ya estaba calculado y nunca se ofrecía. */}
              <Rapido
                disabled={busy || maxTicket <= 0n}
                onClick={() =>
                  setAmount(String(Math.floor(Number(maxTicket) / 1e6)))
                }
              >
                Máximo
              </Rapido>
            </div>

            {amountError === "Saldo insuficiente" && onOpenFunds && (
              <button
                onClick={onOpenFunds}
                className="focusable mt-2 text-[11.5px] font-medium underline decoration-dotted"
                style={{ color: "var(--brand-ink)" }}
              >
                Agregar fondos
              </button>
            )}
          </div>

          <div className="sm:border-l sm:border-border sm:pl-6">
            {/* Mismo registro que el rótulo del campo de al lado: las dos
                columnas empiezan igual porque son las dos mitades de la
                misma frase. */}
            <div className="text-[12.5px] font-medium text-hi">
              Recibes al mes {o.termMonths}
            </div>
            <div className="num mt-1.5 flex items-baseline gap-1.5 text-[24px] font-bold leading-none text-hi">
              {formatUsdc(value + proyeccionInteres, 2)}
              <span className="text-[13px] font-semibold text-mid">USDC</span>
            </div>

            <div className="mt-3">
              <Row
                label="Ganancia estimada"
                value={`+${formatUsdc(proyeccionInteres, 2)}`}
                accent="var(--positive)"
                strong
              />
              <Row
                label="Calificación"
                value={`${score.grade} · ${score.score}`}
              />
              <Row
                label="Cobertura de la garantía"
                value={formatRatio(cov)}
                accent={cov >= 10000 ? "var(--positive)" : "var(--negative)"}
              />
            </div>
          </div>
        </div>

        <section className="mt-5 border-t border-border pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="label">Dónde está tu dinero cada mes</h3>
            <span className="text-[11px] text-low">
              el capital sigue en el contrato hasta el vencimiento
            </span>
          </div>
          <div className="mt-3">
            <ProyeccionTicket o={o} ticket={value} />
          </div>
        </section>

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

/**
 * Un tramo de la barra. La regla que lo separa del siguiente cambia de eje
 * con el ancho: apilados en el teléfono se separan por debajo, en fila se
 * separan al costado. Es la misma regla, no dos decoraciones distintas.
 */
function Grupo({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col justify-center border-b border-border px-4 py-3 last:border-b-0 sm:px-5 lg:border-b-0 lg:border-r lg:last:border-r-0 ${className}`}
    >
      {children}
    </div>
  );
}

/** Un término del crédito: rótulo arriba, cifra abajo. Los tres de la barra
 *  pesan lo mismo porque los tres condicionan la misma decisión; el único
 *  número que los supera es el de la recaudación, que es el estado. */
function Condicion({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="num mt-0.5 text-[17px] font-semibold leading-none text-hi">
        {value}
      </div>
    </div>
  );
}

/** Monto de un toque. Celda de una grilla de cuatro: mismo ancho, misma
 *  altura que el campo de arriba, todos alineados a su borde. */
function Rapido({
  onClick,
  disabled,
  activo,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  /** El monto tecleado coincide con este. Sin esto, apretar 5,000 y ver el
   *  campo en 5,000 no dejaba ninguna marca: los cuatro seguían idénticos y
   *  el único rastro era el anillo de foco, que se va al primer clic afuera. */
  activo?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={activo}
      className="focusable h-10 w-full rounded-[var(--r-input)] border bg-surface px-1 text-[12px] font-medium transition-colors hover:border-[var(--brand-ink)] hover:text-[var(--brand-ink)] disabled:opacity-40"
      style={{
        borderColor: activo ? "var(--brand-ink)" : "var(--border)",
        color: activo ? "var(--brand-ink)" : "var(--text-mid)",
        fontWeight: activo ? 600 : 500,
      }}
    >
      {children}
    </button>
  );
}

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
