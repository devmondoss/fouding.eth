"use client";

import { Fragment, useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { MetricCard } from "@/components/ui/Stat";
import { Waiting } from "@/components/ui/Waiting";
import { BusinessTopBar } from "@/components/flow/BusinessTopBar";
import { SubmissionDetail } from "@/components/flow/SubmissionDetail";
import { fadeUp, press, stagger } from "@/lib/motion";
import { formatDate } from "@/lib/format";
import {
  NEXT_STEP,
  PROJECT_TYPE_LABEL,
  REVIEW_SLA_DAYS,
  STATUS_LABEL,
  STATUS_TONE,
  folio,
  formatUsdcPlain,
} from "@/lib/verifier/submission";
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
  loading,
  onSignOut,
  onNewSubmission,
}: {
  address: string;
  submissions: SubmissionWithEvents[] | null;
  loading: boolean;
  onSignOut: () => void;
  onNewSubmission: () => void;
}) {
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

          <Button size="lg" onClick={onNewSubmission}>
            Nueva solicitud
          </Button>
        </motion.div>

        {loading ? (
          <div className="mt-16 flex justify-center">
            <Waiting label="Cargando tus expedientes" showLabel />
          </div>
        ) : list.length === 0 ? (
          <EmptyDashboard onNewSubmission={onNewSubmission} />
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
        )}
      </main>

      {open && <SubmissionDetail submission={open} onClose={() => setOpen(null)} />}
    </div>
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

function EmptyDashboard({ onNewSubmission }: { onNewSubmission: () => void }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="card mt-7 flex flex-col items-center gap-3 px-6 py-14 text-center"
    >
      <h2 className="h3">Todavía no enviaste ningún expediente</h2>
      <p className="max-w-[420px] text-[13px] leading-relaxed text-mid">
        Son cuatro pasos: tu empresa, el proyecto, lo que pides y la
        documentación. Al final ves el expediente completo antes de enviarlo, y un
        verificador te responde en {REVIEW_SLA_DAYS} días hábiles.
      </p>
      <motion.button
        {...press}
        onClick={onNewSubmission}
        className="mt-2 text-[13px] font-medium underline decoration-dotted"
        style={{ color: "var(--brand-ink)" }}
      >
        Empezar el primero
      </motion.button>
    </motion.div>
  );
}
