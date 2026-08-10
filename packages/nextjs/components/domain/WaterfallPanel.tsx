import { Bloque, Cifra, Encabezado } from "./FichaTab";
import { formatBps, formatUsdc } from "@/lib/format";
import { creditInterest } from "@/lib/opportunity";
import {
  DEFAULT_COSTS,
  computeWaterfall,
  recoveryOnDefaultBps,
} from "@/lib/underwriting";
import type { Opportunity } from "@/lib/types";

/**
 * Quién cobra primero si la empresa no paga.
 *
 * Eran cuatro tarjetas con borde, padding y una barra cada una: la
 * pregunta es de ORDEN y de PROPORCIÓN, y respondida así había que
 * reconstruir mentalmente el reparto sumando cuatro barras que no
 * compartían escala. Ahora hay una sola barra apilada —el reparto
 * completo, a escala, de un vistazo— y debajo las cuatro filas con el
 * detalle.
 *
 * Dos modos: sin default muestra el orden y lo que le toca a cada tramo;
 * con default muestra el reparto REAL de lo recuperado.
 */

const COLOR = [
  "var(--text-low)",
  "var(--border-strong)",
  "var(--brand-strong)",
  "var(--brand-ink)",
] as const;

export function WaterfallPanel({ o }: { o: Opportunity }) {
  const ejecutado = o.status === "defaulted" && o.recoveredAmount != null;

  // El escenario hipotético se calcula sobre la META, no sobre lo
  // recaudado hasta este minuto: describe el crédito, no el momento en
  // que se lo está mirando (misma razón que `recoveryOnDefaultBps`).
  const principal = ejecutado ? o.raisedAmount : o.targetAmount;
  const interes = ejecutado
    ? (o.raisedAmount * BigInt(o.apyBps) * BigInt(o.termMonths)) / 10000n / 12n
    : creditInterest(o);
  const legal = (principal * BigInt(DEFAULT_COSTS.legalBps)) / 10000n;
  const servicing = (principal * BigInt(DEFAULT_COSTS.servicingBps)) / 10000n;

  const recuperado = ejecutado
    ? (o.recoveredAmount ?? 0n)
    : o.collateral.netRecoverableValue;

  const result = computeWaterfall(recuperado, {
    legalCosts: legal,
    servicingFee: servicing,
    principal,
    interest: interes,
  });

  const totalDebido = legal + servicing + principal + interes;
  const recupero = ejecutado
    ? result.investorRecoveryBps
    : recoveryOnDefaultBps(o);
  const alcanza = recupero >= 10000;

  return (
    <div>
      <Encabezado>
        <Cifra
          label={ejecutado ? "Recuperas" : "Recuperarías"}
          value={formatBps(recupero, 0)}
          nota="de tu capital más interés"
          color={alcanza ? "var(--positive)" : "var(--negative)"}
        />
        <Cifra
          label={ejecutado ? "Recuperado" : "Garantía neta"}
          value={formatUsdc(recuperado)}
          nota={ejecutado ? "USDC ingresados al contrato" : "USDC estimados"}
        />
        <Cifra
          label="Total a repartir"
          value={formatUsdc(totalDebido)}
          nota="USDC entre los cuatro tramos"
        />
      </Encabezado>

      {!ejecutado && (
        <p className="mt-3 text-[12px] leading-relaxed text-low">
          Escenario hipotético: la empresa no paga y la garantía se vende a
          su valor neto estimado. Nada de esto ocurrió.
        </p>
      )}

      <Bloque
        titulo="Orden de cobro"
        aparte={
          <span className="text-[11.5px] text-low">
            de arriba hacia abajo, hasta que se acaba
          </span>
        }
      >
        {/* El reparto entero, a escala y en una sola barra. */}
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-soft">
          {result.tiers.map((t, i) => {
            const parte =
              totalDebido > 0n ? Number((t.due * 10000n) / totalDebido) / 100 : 0;
            if (parte <= 0) return null;
            return (
              <span
                key={t.order}
                className="h-full"
                style={{
                  width: `${parte}%`,
                  backgroundColor: COLOR[i],
                  opacity: ejecutado && t.paid === 0n ? 0.25 : 1,
                }}
              />
            );
          })}
        </div>

        <ol className="mt-2.5 flex flex-col">
          {result.tiers.map((t, i) => {
            const mio = t.order === 3 || t.order === 4;
            const corto = t.paid < t.due;

            return (
              <li
                key={t.order}
                className="flex items-baseline gap-2.5 border-b border-border py-2 last:border-b-0"
              >
                <span
                  className="mt-[5px] h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: COLOR[i] }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span
                      className="text-[12.5px] font-medium"
                      style={{
                        color: mio ? "var(--brand-ink)" : "var(--text-hi)",
                      }}
                    >
                      {t.label}
                    </span>
                    {mio && (
                      <span className="text-[11px] text-low">te toca a ti</span>
                    )}
                  </div>
                  <div className="text-[11px] leading-snug text-low">{t.note}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="num text-[12.5px] font-semibold text-hi">
                    {formatUsdc(t.paid)}
                  </div>
                  {corto && (
                    <div
                      className="num text-[11px]"
                      style={{ color: "var(--negative)" }}
                    >
                      de {formatUsdc(t.due)}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Bloque>

      {ejecutado && (
        /* La historia del default terminaba en un porcentaje rojo y la
           persona quedaba sola: qué pasa ahora, quién decide, qué parte
           garantiza el contrato. Es el diferenciador declarado del
           producto; merece el mismo cuidado que el camino feliz. */
        <Bloque titulo="Qué sigue">
          <ol className="flex flex-col gap-2">
            <Paso
              hecho
              titulo="Se declaró el incumplimiento"
              detalle="Tu posición sigue existiendo y no se puede diluir."
            />
            <Paso
              hecho={recuperado > 0n}
              titulo="Ejecución de la garantía"
              detalle="La liquidación del activo ocurre fuera de la cadena."
            />
            <Paso
              hecho={recuperado > 0n}
              titulo="Ingreso del recupero al contrato"
              detalle={
                recuperado > 0n
                  ? `Ingresaron ${formatUsdc(recuperado)} USDC y el reparto de arriba ya se ejecutó.`
                  : "Al ingresar, el contrato reparte según el orden de arriba."
              }
            />
            <Paso
              hecho={false}
              titulo="Cobro de lo que te corresponde"
              detalle="Queda disponible en tu portafolio. Puede ser menor a tu capital."
            />
          </ol>
          <p className="mt-3 border-t border-border pt-2.5 text-[11px] leading-relaxed text-low">
            Los plazos de una ejecución dependen del proceso registral y
            judicial peruano, no del contrato. No prometemos una fecha porque
            no la controlamos.
          </p>
        </Bloque>
      )}
    </div>
  );
}

/** Un paso de la ejecución, con su estado escrito y no solo teñido. */
function Paso({
  hecho,
  titulo,
  detalle,
}: {
  hecho: boolean;
  titulo: string;
  detalle: string;
}) {
  return (
    <li className="flex gap-2.5">
      <span className={hecho ? "marker mt-[7px]" : "marker marker-quiet mt-[7px]"} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[12.5px] font-medium text-hi">{titulo}</span>
          <span
            className="text-[11px] font-medium"
            style={{ color: hecho ? "var(--positive)" : "var(--text-low)" }}
          >
            {hecho ? "hecho" : "pendiente"}
          </span>
        </div>
        <p className="mt-0.5 text-[11.5px] leading-snug text-mid">{detalle}</p>
      </div>
    </li>
  );
}
