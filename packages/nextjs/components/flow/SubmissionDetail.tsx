"use client";

import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { SubmissionReceipt } from "@/components/flow/SubmissionReceipt";
import { formatDate, shortHash } from "@/lib/format";
import {
  EVENT_ACTOR_LABEL,
  EVENT_LABEL,
  NEXT_STEP,
  STATUS_LABEL,
  STATUS_TONE,
  folio,
} from "@/lib/verifier/submission";
import type { SubmissionEvent, SubmissionWithEvents } from "@/lib/verifier/types";

/**
 * El expediente por dentro, del lado de la empresa: qué mandó, quién lo
 * está revisando y qué se decidió.
 *
 * La bitácora no es decoración — es la respuesta a "¿quién revisa esto y
 * cuándo me contestan?", que hasta ahora no vivía en ninguna pantalla.
 * Sale de submission_events (Neon), no de un estado derivado en el
 * cliente: si el verificador tomó el expediente hace dos horas, eso es un
 * hecho registrado, no una suposición del front.
 */
export function SubmissionDetail({
  submission,
  onClose,
}: {
  submission: SubmissionWithEvents;
  onClose: () => void;
}) {
  const s = submission;

  return (
    <Modal
      open
      onClose={onClose}
      title={s.projectTitle}
      subtitle={`${folio(s.id)} · ${s.companyName}`}
      width={620}
    >
      <div className="flex flex-col gap-5">
        <section className="rounded-[var(--r-panel)] border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="label">Estado</div>
            <Pill label={STATUS_LABEL[s.status]} tone={STATUS_TONE[s.status]} dot />
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-mid">
            {NEXT_STEP[s.status]}
          </p>

          {/* Que el honorario del verificador sea fijo es un argumento de
              venta y ya está en /negocios. Acá el dato es quién y desde
              cuándo. */}
          {s.reviewer && (
            <p className="mt-2 border-t border-border pt-2 text-[12px] text-mid">
              Revisa <span className="font-medium text-hi">{s.reviewer}</span>
              {s.reviewStartedAt && ` desde el ${formatDate(s.reviewStartedAt)}`}
            </p>
          )}
        </section>

        {/* El resultado, con el motivo escrito por quien decidió. Un
            rechazo sin motivo es una pared; con motivo es una corrección. */}
        {(s.status === "approved" || s.status === "rejected") && (
          <section
            className="rounded-[var(--r-panel)] border p-4"
            style={{
              borderColor:
                s.status === "approved" ? "var(--positive)" : "var(--negative)",
            }}
          >
            <div
              className="text-[12.5px] font-semibold"
              style={{
                color:
                  s.status === "approved" ? "var(--positive)" : "var(--negative)",
              }}
            >
              {s.status === "approved" ? "Expediente aprobado" : "Expediente rechazado"}
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-mid">
              {s.note ?? "Sin observaciones registradas."}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2 text-[11.5px] text-low">
              {s.decidedBy && <span>Decidió {s.decidedBy}</span>}
              {s.decidedAt && <span>{formatDate(s.decidedAt)}</span>}
              {s.passportTxHash && (
                <span className="num">
                  Pasaporte onchain {shortHash(s.passportTxHash, 6)}
                </span>
              )}
            </div>
          </section>
        )}

        <section>
          <h3 className="label mb-2">Seguimiento</h3>
          <Trail events={s.events} />
        </section>

        <section>
          <h3 className="label mb-2">Lo que enviaste</h3>
          <SubmissionReceipt
            model={{
              id: s.id,
              submittedAt: s.submittedAt,
              companyName: s.companyName,
              companyRuc: s.companyRuc,
              companyWallet: s.companyWallet,
              sector: s.sector,
              city: s.city,
              yearsOperating: s.yearsOperating,
              annualRevenue: s.annualRevenue,
              projectTitle: s.projectTitle,
              projectType: s.projectType,
              useOfFunds: s.useOfFunds,
              requestedAmount: s.requestedAmount,
              termMonths: s.termMonths,
              collateralKind: s.collateralKind,
              collateralValue: s.collateralValue,
              collateralDetail: s.collateralDetail,
              legalPackName: s.legalPackName,
              legalPackHash: s.legalPackHash || null,
            }}
          />
        </section>
      </div>
    </Modal>
  );
}

function Trail({ events }: { events: SubmissionEvent[] }) {
  if (events.length === 0) {
    return <p className="text-[12.5px] text-low">Sin movimientos todavía.</p>;
  }

  return (
    <ol className="flex flex-col">
      {events.map((event, i) => {
        const last = i === events.length - 1;
        return (
          <li key={event.id} className="flex gap-3">
            <div className="flex w-3 shrink-0 flex-col items-center pt-[5px]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: last
                    ? "var(--brand-strong)"
                    : "var(--border-strong)",
                }}
              />
              {!last && (
                <span
                  className="w-px flex-1"
                  style={{ backgroundColor: "var(--border)" }}
                />
              )}
            </div>

            <div className={last ? "pb-0" : "pb-4"}>
              <div className="text-[12.5px] font-medium text-hi">
                {EVENT_LABEL[event.kind]}
              </div>
              <div className="mt-0.5 text-[11.5px] text-low">
                {EVENT_ACTOR_LABEL[event.actorRole]}
                {event.actorRole === "verifier" && event.actor
                  ? ` · ${event.actor}`
                  : ""}{" "}
                · {formatDate(event.createdAt)}
              </div>
              {event.detail && (
                <p className="mt-1 max-w-[440px] text-[12px] leading-relaxed text-mid">
                  {event.detail}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
