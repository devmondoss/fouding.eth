"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Waiting } from "@/components/ui/Waiting";
import { Modal } from "@/components/ui/Modal";
import { formatDate, shortHash } from "@/lib/format";
import { formatUsdcPlain } from "@/lib/verifier/submission";
import type { Company } from "@/lib/verifier/companies";

/**
 * Acreditación de empresas: el trámite que va ANTES de cualquier
 * solicitud. Acá es donde se emite el pasaporte onchain — antes lo hacía
 * la aprobación de un expediente, que mezclaba acreditar al sujeto con
 * aprobar una de sus operaciones.
 */

const LABEL: Record<Company["status"], string> = {
  pending: "En cola",
  in_review: "En revisión",
  verified: "Acreditada",
  rejected: "Rechazada",
};

const TONE: Record<Company["status"], "neutral" | "warning" | "positive" | "negative"> = {
  pending: "neutral",
  in_review: "warning",
  verified: "positive",
  rejected: "negative",
};

export function CompanyQueue({
  apiKey,
  name,
  onPending,
  refreshToken = 0,
}: {
  apiKey: string;
  name: string;
  /** Cuántas empresas esperan trabajo, para la pestaña del panel. Lo
   *  reporta esta sección en vez de pedirle al panel una segunda copia
   *  de la misma lista. */
  onPending?: (n: number) => void;
  /** Cambia cuando el panel pulsa «Actualizar»: una sola orden de
   *  refrescar para todo lo que hay en pantalla. */
  refreshToken?: number;
}) {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<{ c: Company; approve: boolean } | null>(
    null,
  );
  const [note, setNote] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [historial, setHistorial] = useState(10);

  const avisar = useRef(onPending);
  useEffect(() => {
    avisar.current = onPending;
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/verifier/companies", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const list = (await res.json()) as Company[];
      setCompanies(list);
      avisar.current?.(
        list.filter((c) => c.status === "pending" || c.status === "in_review").length,
      );
    } catch {
      setError("No se pudo cargar la lista de empresas.");
      setCompanies([]);
    }
  }, [apiKey]);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  async function claim(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/verifier/companies/${id}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ reviewer: name }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error ?? "No se pudo tomar la empresa");
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo tomar la empresa");
    } finally {
      setBusyId(null);
    }
  }

  async function decide(id: string, approve: boolean) {
    setBusyId(id);
    setDecisionError(null);
    try {
      const res = await fetch(`/api/verifier/companies/${id}/decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ approve, decidedBy: name, note: note || undefined }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error ?? `La decisión no se registró (HTTP ${res.status}).`);
      }
      setDeciding(null);
      await load();
    } catch (cause) {
      setDecisionError(
        cause instanceof Error ? cause.message : "La decisión no se pudo registrar.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const enCola = (companies ?? []).filter(
    (c) => c.status === "pending" || c.status === "in_review",
  );
  const decididas = (companies ?? []).filter(
    (c) => c.status === "verified" || c.status === "rejected",
  );

  return (
    <section className="mt-6 flex flex-col gap-3">
      {error && (
        <div
          className="rounded-[var(--r-panel)] border px-4 py-3 text-[13px]"
          style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
        >
          {error}
        </div>
      )}

      {companies === null && <Waiting label="Cargando empresas" showLabel />}

      {companies !== null && enCola.length === 0 && (
        <p className="text-[13px] text-low">
          Ninguna empresa espera acreditación.
        </p>
      )}

      {enCola.map((c) => (
        <div key={c.id} className="card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="h3 truncate">{c.name}</h3>
                <Pill label={LABEL[c.status]} tone={TONE[c.status]} dot />
              </div>
              <p className="mt-0.5 text-[12.5px] text-mid">
                RUC {c.ruc} · {c.sector}, {c.city}
              </p>
              <p className="num mt-1 text-[11.5px] text-low">
                {shortHash(c.wallet, 6)} · enviada {formatDate(c.submittedAt)}
                {c.reviewer && ` · tomada por ${c.reviewer}`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="num text-[14px] font-semibold text-hi">
                {c.yearsOperating} años
              </div>
              <div className="text-[11px] text-low">de operación</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border pt-3 sm:grid-cols-4">
            <Dato label="Colaboradores" value={c.employees ? String(c.employees) : "—"} />
            <Dato
              label="Ventas declaradas"
              value={c.annualRevenue ? `${formatUsdcPlain(c.annualRevenue)} USDC` : "—"}
            />
            <Dato label="Documento" value={c.legalPackName || "Sin adjuntar"} />
            <Dato
              label="Huella"
              value={c.legalPackHash ? shortHash(c.legalPackHash, 5) : "—"}
            />
          </div>

          <div className="mt-3.5 flex items-center gap-2 border-t border-border pt-3.5">
            {c.status === "pending" ? (
              <>
                <Button size="sm" loading={busyId === c.id} onClick={() => claim(c.id)}>
                  Tomar acreditación
                </Button>
                <span className="text-[11px] text-low">
                  La empresa verá tu nombre y desde cuándo la revisas
                </span>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  loading={busyId === c.id}
                  onClick={() => {
                    setNote("");
                    setDecisionError(null);
                    setDeciding({ c, approve: true });
                  }}
                >
                  Acreditar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  loading={busyId === c.id}
                  onClick={() => {
                    setNote("");
                    setDecisionError(null);
                    setDeciding({ c, approve: false });
                  }}
                >
                  Rechazar
                </Button>
                <span className="ml-auto text-[11px] text-low">
                  Acreditar emite su pasaporte onchain
                </span>
              </>
            )}
          </div>
        </div>
      ))}

      {decididas.length > 0 && (
        <>
          <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
            <h2 className="label">Ya decididas</h2>
            <span className="num text-[11.5px] text-low">{decididas.length}</span>
          </div>
          {decididas.slice(0, historial).map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-4 rounded-[var(--r-panel)] border border-border px-4 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-hi">{c.name}</div>
                <div className="truncate text-[11.5px] text-low">
                  RUC {c.ruc}
                  {c.decidedBy && ` · ${c.decidedBy}`}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {c.passportTxHash && (
                  <span className="num text-[11.5px] text-low">
                    {shortHash(c.passportTxHash, 5)}
                  </span>
                )}
                <Pill label={LABEL[c.status]} tone={TONE[c.status]} dot />
              </div>
            </div>
          ))}
          {historial < decididas.length && (
            <button
              onClick={() => setHistorial((n) => n + 20)}
              className="focusable self-start text-[12.5px] font-medium underline decoration-dotted"
              style={{ color: "var(--brand-ink)" }}
            >
              Ver {Math.min(20, decididas.length - historial)} más
            </button>
          )}
        </>
      )}

      <Modal
        open={deciding !== null}
        onClose={() => setDeciding(null)}
        title={deciding?.approve ? "Acreditar la empresa" : "Rechazar la empresa"}
        subtitle={deciding ? `${deciding.c.name} — RUC ${deciding.c.ruc}` : undefined}
        width={480}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeciding(null)}>
              Cancelar
            </Button>
            <Button
              variant={deciding?.approve ? "primary" : "danger"}
              loading={busyId === deciding?.c.id}
              disabled={!deciding?.approve && note.trim().length < 10}
              onClick={() => deciding && decide(deciding.c.id, deciding.approve)}
            >
              {deciding?.approve ? "Acreditar y emitir pasaporte" : "Rechazar"}
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-mid">
          {deciding?.approve
            ? "Emite el pasaporte de esta empresa onchain y la habilita a pedir financiamiento. No se revierte."
            : "El motivo se le muestra al dueño del negocio, que puede corregir y volver a enviar."}
        </p>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-hi">
            {deciding?.approve ? "Nota interna (opcional)" : "Motivo del rechazo"}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder={
              deciding?.approve
                ? "Qué se verificó y contra qué documento."
                : "Qué falta o qué no cuadra, en términos que el dueño pueda accionar."
            }
            className="w-full resize-y rounded-[var(--r-input)] border border-border bg-surface px-3 py-2 text-[13px] leading-relaxed text-hi outline-none transition-colors focus:border-[var(--brand-ink)]"
          />
        </label>

        {decisionError && (
          <p
            role="alert"
            className="mt-3 rounded-[var(--r-panel)] border px-3 py-2 text-[12px]"
            style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
          >
            {decisionError}
          </p>
        )}
      </Modal>
    </section>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <div className="num mt-0.5 truncate text-[12.5px] font-medium text-hi" title={value}>
        {value}
      </div>
    </div>
  );
}
