"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clock, Lock, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, EmptyState } from "@/components/ui/Field";
import { shortHash } from "@/lib/format";
import type { VerifierSubmission } from "@/lib/verifier/types";

/**
 * Panel interno del verificador. Deliberadamente FUERA del módulo único
 * del inversionista (design-system.md §6) — esto no es parte del
 * producto que ve un inversionista, es herramienta operativa. No usa
 * `useSession`/Privy: se protege con la API key de
 * `lib/verifier/auth.ts`, guardada en localStorage de este navegador.
 */

const KEY_STORAGE = "founding.verifier.apiKey";
const NAME_STORAGE = "founding.verifier.name";

const STATUS_LABEL: Record<VerifierSubmission["status"], string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
};

const STATUS_COLOR: Record<VerifierSubmission["status"], string> = {
  pending: "var(--warning)",
  approved: "var(--positive)",
  rejected: "var(--negative)",
};

export default function VerifierPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    setApiKey(window.localStorage.getItem(KEY_STORAGE));
    setName(window.localStorage.getItem(NAME_STORAGE) ?? "");
  }, []);

  function unlock() {
    if (!keyInput.trim() || !nameInput.trim()) return;
    window.localStorage.setItem(KEY_STORAGE, keyInput.trim());
    window.localStorage.setItem(NAME_STORAGE, nameInput.trim());
    setApiKey(keyInput.trim());
    setName(nameInput.trim());
  }

  function lock() {
    window.localStorage.removeItem(KEY_STORAGE);
    setApiKey(null);
  }

  if (!apiKey) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-5"
        style={{ backgroundColor: "var(--bg)" }}
      >
        <div className="card w-full max-w-[380px] p-6">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-mid" />
            <h1 className="h2 text-[17px]">Panel del verificador</h1>
          </div>
          <p className="mt-1.5 text-[12.5px] text-mid">
            Acceso interno — pedí la API key al equipo.
          </p>

          <div className="mt-5 flex flex-col gap-4">
            <Field
              label="Tu nombre"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Para el registro de decisiones"
            />
            <Field
              label="API key"
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="VERIFIER_API_KEY"
            />
          </div>

          <Button className="mt-5 w-full" onClick={unlock}>
            Entrar
          </Button>
        </div>
      </div>
    );
  }

  return <Panel apiKey={apiKey} name={name} onLock={lock} />;
}

function Panel({
  apiKey,
  name,
  onLock,
}: {
  apiKey: string;
  name: string;
  onLock: () => void;
}) {
  const [submissions, setSubmissions] = useState<VerifierSubmission[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/verifier/submissions", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.status === 401) {
        setError("API key inválida.");
        setSubmissions([]);
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      setSubmissions((await res.json()) as VerifierSubmission[]);
    } catch {
      setError("No se pudo cargar la lista.");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, approve: boolean) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/verifier/submissions/${id}/decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ approve, decidedBy: name }),
      });
      if (res.ok) await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen px-6 py-8" style={{ backgroundColor: "var(--bg)" }}>
      <div className="mx-auto max-w-[760px]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="h1 text-[22px]">Panel del verificador</h1>
            <p className="mt-1 text-[12.5px] text-mid">Conectado como {name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={load}>
              Actualizar
            </Button>
            <Button variant="ghost" size="sm" onClick={onLock}>
              Salir
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {loading && !submissions && (
            <p className="text-[13px] text-low">Cargando…</p>
          )}

          {error && (
            <div
              className="rounded-[var(--r-panel)] border px-4 py-3 text-[13px]"
              style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
            >
              {error}
            </div>
          )}

          {submissions?.length === 0 && !error && (
            <EmptyState
              title="No hay expedientes"
              detail="Todavía no llegó ninguna solicitud para revisar."
            />
          )}

          {submissions?.map((s) => (
            <div key={s.id} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="h3">{s.projectTitle}</h3>
                    <span
                      className="flex items-center gap-1 rounded-[var(--r-pill)] border px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        borderColor: STATUS_COLOR[s.status],
                        color: STATUS_COLOR[s.status],
                      }}
                    >
                      {s.status === "pending" && <Clock className="h-3 w-3" />}
                      {STATUS_LABEL[s.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-mid">
                    {s.companyName} {s.companyRuc && `· RUC ${s.companyRuc}`}
                  </p>
                  <p className="num mt-1.5 text-[11.5px] text-low">
                    {shortHash(s.companyWallet, 6)} · hash{" "}
                    {s.legalPackHash ? shortHash(s.legalPackHash, 6) : "—"}
                  </p>
                  {s.note && (
                    <p className="mt-1.5 text-[12px] text-mid">Nota: {s.note}</p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <div className="num text-[15px] font-semibold text-hi">
                    {s.requestedAmount}
                  </div>
                  <div className="text-[11px] text-low">solicitado</div>
                </div>
              </div>

              {s.status === "pending" && (
                <div className="mt-3.5 flex gap-2 border-t border-border pt-3.5">
                  <Button
                    size="sm"
                    icon={<Check className="h-3.5 w-3.5" />}
                    loading={busyId === s.id}
                    onClick={() => decide(s.id, true)}
                  >
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<X className="h-3.5 w-3.5" />}
                    loading={busyId === s.id}
                    onClick={() => decide(s.id, false)}
                  >
                    Rechazar
                  </Button>
                  {s.status === "pending" && (
                    <span className="ml-auto flex items-center gap-1 text-[11px] text-low">
                      <ShieldCheck className="h-3 w-3" />
                      Honorario fijo, apruebe o rechace
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
