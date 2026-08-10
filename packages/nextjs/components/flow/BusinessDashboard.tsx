"use client";

import { Fragment, useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { MetricCard } from "@/components/ui/Stat";
import { Waiting } from "@/components/ui/Waiting";
import { BusinessTopBar } from "@/components/flow/BusinessTopBar";
import { SubmissionDetail } from "@/components/flow/SubmissionDetail";
import { fadeUp, stagger } from "@/lib/motion";
import { formatDate, shortHash } from "@/lib/format";
import {
  MAX_REQUESTED_USDC,
  MIN_REQUESTED_USDC,
  MIN_YEARS_OPERATING,
  NEXT_STEP,
  PROJECT_TYPE_LABEL,
  REVIEW_SLA_DAYS,
  STATUS_LABEL,
  STATUS_TONE,
  TERM_PRESETS,
  folio,
  formatUsdcPlain,
} from "@/lib/verifier/submission";
import type { Company } from "@/lib/verifier/companies";
import type { SubmissionWithEvents } from "@/lib/verifier/types";

/**
 * Home del dueño de negocio. Su trabajo es responder, sin que haya que
 * preguntar: qué mandaste, en qué punto está, quién lo tiene y qué sigue.
 * Antes esta ruta caía directo a un formulario en blanco y, una vez
 * enviado, no quedaba ningún lugar al que volver (ver conversación de
 * agosto 2026).
 */
export function BusinessDashboard({
  address,
  submissions,
  empresa,
  loading,
  onSignOut,
  onNewSubmission,
  onAcreditar,
}: {
  address: string;
  submissions: SubmissionWithEvents[] | null;
  /** La empresa de esta wallet. `undefined` mientras se resuelve. */
  empresa: Company | null | undefined;
  loading: boolean;
  onSignOut: () => void;
  onNewSubmission: () => void;
  onAcreditar: () => void;
}) {
  /** Sin empresa acreditada no hay solicitud posible: la API lo rechaza
   * con 409, así que la pantalla no puede ofrecerlo como si se pudiera. */
  const acreditada = empresa?.status === "verified";
  const [open, setOpen] = useState<SubmissionWithEvents | null>(null);
  const list = submissions ?? [];
  const totalRequested = list.reduce(
    (acc, s) => acc + (Number(s.requestedAmount) || 0),
    0,
  );
  const inFlight = list.filter(
    (s) => s.status === "pending" || s.status === "in_review",
  ).length;
  const approved = list.filter((s) => s.status === "approved").length;

  return (
    <div className="flex min-h-screen flex-col">
      <BusinessTopBar address={address} onSignOut={onSignOut} />

      <main className="mx-auto w-full max-w-[var(--w-doc)] flex-1 px-5 py-8 sm:px-6 sm:py-10">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="flex flex-wrap items-end justify-between gap-3"
        >
          <div>
            <div className="label">Panel de la empresa</div>
            {/* El párrafo que explicaba que revisa un humano se fue: cada
                tarjeta ya dice quién revisa y desde cuándo, con nombre. La
                promesa no hay que enunciarla si el dato está en pantalla. */}
            <h1 className="h1 mt-1.5">Tus solicitudes</h1>
          </div>

          {/* Una sola acción principal, y solo cuando se puede ejecutar:
              pedir financiamiento sin acreditación termina en 409.

              Sin acreditar, acá NO va nada. La acreditación la ofrece el
              bloque "Tu empresa" de abajo, que es el que explica por qué
              hace falta; ponerla también en la cabecera —y otra vez al pie
              de "Qué necesitas"— dejaba tres botones idénticos en una
              pantalla, uno de ellos sin contexto ninguno. */}
          {acreditada && (
            <Button size="lg" onClick={onNewSubmission}>
              Nueva solicitud
            </Button>
          )}
        </motion.div>

        {loading ? (
          <div className="mt-16 flex justify-center">
            <Waiting label="Cargando tu panel" showLabel />
          </div>
        ) : (
          <EstadoEmpresa empresa={empresa} onAcreditar={onAcreditar} />
        )}

        {!loading && (list.length === 0 ? (
          <EmptyDashboard
            acreditada={acreditada}
            onNewSubmission={onNewSubmission}
          />
        ) : (
          <>
            <motion.div
              variants={stagger()}
              initial="hidden"
              animate="show"
              className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3"
            >
              <motion.div variants={fadeUp}>
                <MetricCard
                  label="Solicitado"
                  value={formatUsdcPlain(totalRequested)}
                  unit="USDC en total"
                />
              </motion.div>
              <motion.div variants={fadeUp}>
                <MetricCard
                  label="En revisión"
                  value={inFlight}
                  unit={inFlight === 1 ? "expediente" : "expedientes"}
                  accent={inFlight > 0 ? "var(--warning)" : undefined}
                />
              </motion.div>
              <motion.div variants={fadeUp} className="col-span-2 sm:col-span-1">
                <MetricCard
                  label="Aprobadas"
                  value={approved}
                  unit={approved === 1 ? "operación" : "operaciones"}
                  accent={approved > 0 ? "var(--positive)" : undefined}
                />
              </motion.div>
            </motion.div>

            <motion.div
              variants={stagger()}
              initial="hidden"
              animate="show"
              className="mt-4 flex flex-col gap-3"
            >
              {list.map((s) => (
                <motion.article
                  key={s.id}
                  variants={fadeUp}
                  className="card p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="num text-[11px] text-low">{folio(s.id)}</div>
                      <h2 className="h3 mt-0.5 truncate">{s.projectTitle}</h2>
                      <div className="mt-1 text-[12.5px] text-mid">
                        <span className="num font-medium text-hi">
                          {formatUsdcPlain(s.requestedAmount)}
                        </span>{" "}
                        USDC
                        {s.termMonths > 0 && ` · ${s.termMonths} meses`}
                        {PROJECT_TYPE_LABEL[s.projectType] &&
                          ` · ${PROJECT_TYPE_LABEL[s.projectType]}`}
                      </div>
                      <div className="mt-0.5 text-[12px] text-low">
                        Enviada {formatDate(s.submittedAt)}
                        {s.reviewer && ` · revisa ${s.reviewer}`}
                      </div>
                    </div>
                    <Pill
                      label={STATUS_LABEL[s.status]}
                      tone={STATUS_TONE[s.status]}
                      dot
                    />
                  </div>

                  <div className="mt-4 border-t border-border pt-4">
                    <Timeline submission={s} />
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-4">
                    <p className="max-w-[420px] text-[12.5px] leading-relaxed text-mid">
                      {s.status === "rejected" && s.note
                        ? `Observación: ${s.note}`
                        : NEXT_STEP[s.status]}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setOpen(s)}>
                      Ver expediente
                    </Button>
                  </div>
                </motion.article>
              ))}
            </motion.div>
          </>
        ))}
      </main>

      {open && <SubmissionDetail submission={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/**
 * Dónde está la empresa. Es lo primero del panel porque condiciona todo
 * lo demás: sin acreditación no se puede pedir financiamiento, y antes
 * eso no se decía en ningún lado — el dueño de negocio solo descubría el
 * requisito al recibir un error.
 */
function EstadoEmpresa({
  empresa,
  onAcreditar,
}: {
  empresa: Company | null | undefined;
  onAcreditar: () => void;
}) {
  if (empresa === undefined) return null;

  if (empresa === null) {
    return (
      <motion.section
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="card mt-7 flex flex-wrap items-center justify-between gap-4 p-5"
      >
        <div className="min-w-0">
          <div className="label">Tu empresa</div>
          <p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-mid">
            Todavía no está acreditada. Es un trámite de una sola vez —seis
            campos— y sin él no se pueden pedir operaciones.
          </p>
        </div>
        <Button onClick={onAcreditar}>Acreditar mi empresa</Button>
      </motion.section>
    );
  }

  const enRevision = empresa.status === "pending" || empresa.status === "in_review";
  const color =
    empresa.status === "verified"
      ? "var(--positive)"
      : empresa.status === "rejected"
        ? "var(--negative)"
        : "var(--warning)";

  return (
    <motion.section
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="card mt-7 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="label">Tu empresa</div>
          <h2 className="h3 mt-1 truncate">{empresa.name}</h2>
          <div className="mt-1 text-[12.5px] text-mid">
            RUC {empresa.ruc}
            {empresa.sector && ` · ${empresa.sector}`}
            {empresa.city && `, ${empresa.city}`}
          </div>
        </div>
        <Pill
          label={
            empresa.status === "verified"
              ? "Acreditada"
              : empresa.status === "rejected"
                ? "No acreditada"
                : empresa.status === "in_review"
                  ? "En revisión"
                  : "En cola"
          }
          tone={
            empresa.status === "verified"
              ? "positive"
              : empresa.status === "rejected"
                ? "negative"
                : "warning"
          }
          dot
        />
      </div>

      <div className="mt-3 border-t border-border pt-3">
        {empresa.status === "verified" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] leading-relaxed text-mid">
              Acreditada{empresa.decidedBy ? ` por ${empresa.decidedBy}` : ""}
              {empresa.decidedAt ? ` el ${formatDate(empresa.decidedAt)}` : ""}. Ya
              puedes pedir financiamiento para tus proyectos.
            </p>
            {empresa.passportTxHash && (
              <span className="num text-[11.5px]" style={{ color }}>
                Pasaporte onchain {shortHash(empresa.passportTxHash, 6)}
              </span>
            )}
          </div>
        ) : enRevision ? (
          <p className="text-[12.5px] leading-relaxed text-mid">
            {empresa.reviewer
              ? `La está revisando ${empresa.reviewer}`
              : `En cola de acreditación`}
            . Te responden en {REVIEW_SLA_DAYS} días hábiles; mientras tanto no
            se pueden enviar solicitudes.
          </p>
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="max-w-[52ch] text-[12.5px] leading-relaxed text-mid">
              {empresa.note ?? "No pasó la acreditación."} Corrige lo observado y
              vuelve a enviarla.
            </p>
            <Button size="sm" onClick={onAcreditar}>
              Corregir y reenviar
            </Button>
          </div>
        )}
      </div>
    </motion.section>
  );
}

const STAGES = ["Enviada", "En revisión", "Resultado", "Publicada"] as const;

/**
 * Cuatro estaciones, no tres: publicar es un acto separado de aprobar
 * (aprobar acredita a la empresa; publicar fija las condiciones y la saca
 * al catálogo), y la empresa tenía derecho a ver que ese paso existe.
 * La última la marca un evento real de la bitácora, no una inferencia.
 */
function Timeline({ submission }: { submission: SubmissionWithEvents }) {
  const published = submission.events.some((e) => e.kind === "published");
  const decided =
    submission.status === "approved" || submission.status === "rejected";

  const current = published
    ? 3
    : decided
      ? 2
      : submission.status === "in_review"
        ? 1
        : 0;

  const endColor =
    submission.status === "approved"
      ? "var(--positive)"
      : submission.status === "rejected"
        ? "var(--negative)"
        : "var(--text-low)";

  const labels = [
    STAGES[0],
    STAGES[1],
    submission.status === "approved"
      ? "Aprobado"
      : submission.status === "rejected"
        ? "Rechazado"
        : STAGES[2],
    STAGES[3],
  ];

  const colorAt = (i: number) => {
    if (i === 2 && decided) return endColor;
    return i <= current ? "var(--brand-strong)" : "var(--border-strong)";
  };

  return (
    <div>
      <div className="flex items-center">
        {labels.map((label, i) => (
          <Fragment key={label}>
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: colorAt(i) }}
            />
            {i < labels.length - 1 && (
              <span
                className="h-px flex-1"
                style={{
                  backgroundColor:
                    i < current ? "var(--brand-strong)" : "var(--border)",
                }}
              />
            )}
          </Fragment>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between">
        {labels.map((label, i) => (
          <span
            key={label}
            className="text-[11px] font-medium"
            style={{
              color:
                i === 2 && decided
                  ? endColor
                  : i <= current
                    ? "var(--text-hi)"
                    : "var(--text-low)",
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Sin expedientes, esta pantalla era una caja centrada con tres líneas y
 * media pantalla en blanco: el dueño de negocio veía menos producto que
 * el inversionista, cuando de su lado hay igual de cosas que decir.
 *
 * Lo que llena el vacío son las condiciones del programa, el proceso y
 * los requisitos — todo dato verdadero, sacado de las mismas constantes
 * que validan el formulario (lib/verifier/submission.ts). Nada de
 * tracción inventada: no se cuentan empresas financiadas ni montos
 * colocados, porque el catálogo es sembrado y decirlo sería fabricar
 * evidencia (PRODUCT.md §Evidence).
 */
function EmptyDashboard({
  acreditada,
  onNewSubmission,
}: {
  acreditada: boolean;
  onNewSubmission: () => void;
}) {
  const condiciones = [
    {
      dato: `Desde ${formatUsdcPlain(MIN_REQUESTED_USDC)}`,
      unidad: "USDC",
      pie: `hasta ${formatUsdcPlain(MAX_REQUESTED_USDC)}`,
    },
    {
      dato: `${TERM_PRESETS[0]} a ${TERM_PRESETS[TERM_PRESETS.length - 1]}`,
      unidad: "meses",
      pie: "el plazo lo fija el verificador",
    },
    {
      dato: String(REVIEW_SLA_DAYS),
      unidad: "días hábiles",
      pie: "para tener respuesta",
    },
    {
      dato: "Por hitos",
      unidad: "",
      pie: "el capital se libera por tramos",
    },
  ];

  // Son dos trámites y el proceso tiene que decirlo: acreditar la empresa
  // pasó a ser un paso propio, y con él se mudó el pasaporte —antes lo
  // emitía la aprobación del primer expediente, que mezclaba acreditar al
  // sujeto con aprobar una operación suya.
  const pasos = [
    {
      titulo: "Acreditas tu empresa",
      detalle:
        "Una sola vez, seis campos. Si pasa la revisión, tu empresa recibe su pasaporte onchain y queda habilitada.",
    },
    {
      titulo: "Envías la solicitud",
      detalle:
        "Tres pasos: el proyecto, lo que pides y la documentación. Antes de enviarla la ves completa.",
    },
    {
      titulo: "Resultado con motivo",
      detalle:
        "Ves quién la revisa y desde cuándo. Cobra honorario fijo: gana lo mismo si aprueba que si rechaza, y si rechaza te deja por escrito qué corregir.",
    },
    {
      titulo: "Se publica y se financia",
      detalle:
        "El verificador fija plazo, rentabilidad e hitos, y los inversionistas aportan el capital.",
    },
  ];

  const requisitos = [
    `RUC vigente — se contrasta contra SUNAT`,
    `${MIN_YEARS_OPERATING} años de operación como mínimo`,
    "Una garantía inscribible: maquinaria, vehículo o inmueble",
    "Ventas del último año (opcional, acelera la revisión)",
  ];

  return (
    <motion.div variants={stagger()} initial="hidden" animate="show" className="mt-7">
      {/* Las condiciones primero: es lo que un dueño de negocio necesita
          para saber si esto le sirve, antes de invertir media hora en un
          formulario. */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {condiciones.map((c) => (
          <div key={c.dato} className="card p-4">
            <div className="num text-[18px] font-semibold leading-none text-hi">
              {c.dato}
              {c.unidad && (
                <span className="ml-1 text-[12px] font-medium text-mid">{c.unidad}</span>
              )}
            </div>
            <div className="mt-1.5 text-[11.5px] leading-snug text-low">{c.pie}</div>
          </div>
        ))}
      </motion.div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.35fr_1fr]">
        <motion.section variants={fadeUp} className="card p-5">
          <h2 className="label">Cómo funciona</h2>
          <ol className="mt-3 flex flex-col gap-3">
            {pasos.map((p, i) => (
              <li key={p.titulo} className="flex gap-3">
                <span
                  className="num mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={{
                    backgroundColor: "var(--brand-soft)",
                    color: "var(--brand-ink)",
                  }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-hi">
                    {p.titulo}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-relaxed text-mid">
                    {p.detalle}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </motion.section>

        <motion.section variants={fadeUp} className="card flex flex-col p-5">
          <h2 className="label">Qué necesitas</h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {requisitos.map((r) => (
              <li
                key={r}
                className="border-b border-border pb-2.5 text-[12.5px] leading-relaxed text-mid last:border-b-0 last:pb-0"
              >
                {r}
              </li>
            ))}
          </ul>

          {/* El botón solo aparece cuando la acción que toca es ESTA. Sin
              acreditar, el paso siguiente no es armar una solicitud sino
              acreditar la empresa, y ese botón ya está arriba, en su
              bloque: repetirlo acá era el tercer "Acreditar mi empresa" de
              la misma pantalla. Queda la frase, que sí dice algo nuevo —
              en qué orden van los dos trámites. */}
          <div className="mt-auto pt-5">
            {acreditada ? (
              <>
                <Button size="lg" className="w-full" onClick={onNewSubmission}>
                  Armar mi solicitud
                </Button>
                <p className="mt-2 text-[11.5px] leading-snug text-low">
                  Puedes enviarla sin adjuntar documentos: el verificador te los
                  pide si le faltan.
                </p>
              </>
            ) : (
              <p className="text-[11.5px] leading-snug text-low">
                Primero se acredita la empresa, una sola vez —el trámite está
                arriba, en «Tu empresa»—. Después cada proyecto es solo el
                proyecto.
              </p>
            )}
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}
