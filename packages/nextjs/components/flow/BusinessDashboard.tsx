"use client";

import { Fragment } from "react";
import { motion } from "motion/react";
import { FileText, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { MetricCard } from "@/components/ui/Stat";
import { BusinessTopBar } from "@/components/flow/BusinessTopBar";
import { fadeUp, press, stagger } from "@/lib/motion";
import { formatDate } from "@/lib/format";
import type { SubmissionStatus, VerifierSubmission } from "@/lib/verifier/types";

const STATUS_TONE = {
  pending: "warning",
  approved: "positive",
  rejected: "negative",
} as const;

const STATUS_LABEL = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
} as const;

const nf = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });

/**
 * Home del dueño de negocio. Su trabajo es responder, sin que haya que
 * preguntar: qué mandaste, en qué punto está, y qué sigue. Antes esta
 * ruta caía directo a un formulario en blanco y, una vez enviado, no
 * quedaba ningún lugar al que volver (ver conversación de agosto 2026).
 */
export function BusinessDashboard({
  address,
  submissions,
  loading,
  onSignOut,
  onNewSubmission,
}: {
  address: string;
  submissions: VerifierSubmission[] | null;
  loading: boolean;
  onSignOut: () => void;
  onNewSubmission: () => void;
}) {
  const list = submissions ?? [];
  const totalRequested = list.reduce(
    (acc, s) => acc + (Number(s.requestedAmount) || 0),
    0,
  );
  const pending = list.filter((s) => s.status === "pending").length;
  const approved = list.filter((s) => s.status === "approved").length;

  return (
    <div className="flex min-h-screen flex-col">
      <BusinessTopBar address={address} onSignOut={onSignOut} />

      <main className="mx-auto w-full max-w-[860px] flex-1 px-5 py-8 sm:px-6 sm:py-10">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="flex flex-wrap items-end justify-between gap-3"
        >
          <div>
            <div className="label">Panel de la empresa</div>
            <h1 className="h1 mt-1.5">Tus solicitudes</h1>
            <p className="mt-1.5 max-w-[520px] text-[13.5px] leading-relaxed text-mid">
              Cada expediente lo revisa un verificador humano antes de
              publicarse — nada se ofrece a inversionistas sin pasar por ahí.
            </p>
          </div>

          <Button
            size="lg"
            onClick={onNewSubmission}
            icon={<Plus className="h-4 w-4" />}
          >
            Nueva solicitud
          </Button>
        </motion.div>

        {loading ? (
          <div className="mt-16 flex justify-center">
            <Loader2
              className="h-5 w-5 animate-spin"
              style={{ color: "var(--brand-ink)" }}
            />
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
                  value={nf.format(totalRequested)}
                  unit="USDC en total"
                />
              </motion.div>
              <motion.div variants={fadeUp}>
                <MetricCard
                  label="En revisión"
                  value={pending}
                  unit={pending === 1 ? "expediente" : "expedientes"}
                  accent={pending > 0 ? "var(--warning)" : undefined}
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
                <motion.article key={s.id} variants={fadeUp} className="card p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="h3 truncate">{s.projectTitle}</h2>
                      <div className="mt-1 text-[12.5px] text-mid">
                        <span className="num font-medium text-hi">
                          {nf.format(Number(s.requestedAmount) || 0)}
                        </span>{" "}
                        USDC · {s.companyName} · enviada {formatDate(s.submittedAt)}
                      </div>
                    </div>
                    <Pill
                      label={STATUS_LABEL[s.status]}
                      tone={STATUS_TONE[s.status]}
                      dot
                    />
                  </div>

                  <div className="mt-4 border-t border-border pt-4">
                    <Timeline status={s.status} />
                  </div>

                  <p className="mt-3 text-[12.5px] leading-relaxed text-mid">
                    {s.note ?? NEXT_STEP[s.status]}
                  </p>
                </motion.article>
              ))}
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}

/** Qué sigue, en castellano llano — el dato que faltaba por completo. */
const NEXT_STEP: Record<SubmissionStatus, string> = {
  pending:
    "Un verificador está revisando el expediente. Te avisamos acá mismo cuando haya decisión — no tienes que hacer nada más por ahora.",
  approved:
    "Tu wallet quedó habilitada. La operación se publica en el marketplace para que los inversionistas la financien.",
  rejected:
    "El expediente no pasó la revisión. Puedes corregir lo observado y enviar una solicitud nueva.",
};

const STAGES = ["Enviada", "En revisión", "Resultado"] as const;

function Timeline({ status }: { status: SubmissionStatus }) {
  // pending se queda en "En revisión"; aprobado/rechazado llegan al final.
  const current = status === "pending" ? 1 : 2;
  const endColor =
    status === "approved"
      ? "var(--positive)"
      : status === "rejected"
        ? "var(--negative)"
        : "var(--text-low)";

  const labels = [
    STAGES[0],
    STAGES[1],
    status === "approved" ? "Aprobado" : status === "rejected" ? "Rechazado" : STAGES[2],
  ];

  const colorAt = (i: number) => {
    if (i === 2 && current === 2) return endColor;
    return i <= current ? "var(--brand-ink)" : "var(--border-strong)";
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
                    i < current ? "var(--brand-ink)" : "var(--border)",
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
                i === 2 && current === 2
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
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--brand-soft)" }}
      >
        <FileText className="h-5 w-5" style={{ color: "var(--brand-ink)" }} />
      </span>
      <h2 className="h3">Todavía no enviaste ninguna solicitud</h2>
      <p className="max-w-[400px] text-[13px] leading-relaxed text-mid">
        Son tres pasos: los datos de tu empresa, el proyecto que quieres
        financiar y el expediente legal. Puedes guardarlo y volver cuando
        quieras.
      </p>
      <motion.button
        {...press}
        onClick={onNewSubmission}
        className="mt-2 text-[13px] font-medium underline decoration-dotted"
        style={{ color: "var(--brand-ink)" }}
      >
        Empezar la primera
      </motion.button>
    </motion.div>
  );
}
