"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  FileText,
  Lock,
  RefreshCw,
  Send,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, EmptyState } from "@/components/ui/Field";
import { AccessRequests } from "@/components/verifier/AccessRequests";
import { PublishOpportunityForm } from "@/components/verifier/PublishOpportunityForm";
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
  // Expediente que se está publicando como oportunidad, y el aviso de que
  // ya se publicó (slug) — ver PublishOpportunityForm.
  const [publishing, setPublishing] = useState<VerifierSubmission | null>(null);
  const [published, setPublished] = useState<string | null>(null);

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

  async function viewDocument(hash: string) {
    const res = await fetch(`/api/verifier/documents/${hash}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    // Blob URL, no la URL de la API directa — así no hace falta mandar
    // el header de auth en una navegación normal, que el navegador no
    // permite para links/pestañas nuevas.
    window.open(URL.createObjectURL(blob), "_blank");
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

        <UploadWidget apiKey={apiKey} />

        <AccessRequests apiKey={apiKey} />

        {published && (
          <div
            className="mt-4 flex items-center gap-2 rounded-[var(--r-panel)] border px-4 py-3 text-[13px]"
            style={{ borderColor: "var(--positive)", color: "var(--positive)" }}
          >
            <Check className="h-4 w-4 shrink-0" />
            Publicada en el catálogo como <span className="num">{published}</span>
            <button
              onClick={() => setPublished(null)}
              className="ml-auto text-[12px] text-mid transition-colors hover:text-hi"
            >
              Cerrar
            </button>
          </div>
        )}

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
                  <p className="num mt-1.5 flex items-center gap-1.5 text-[11.5px] text-low">
                    {shortHash(s.companyWallet, 6)} · hash{" "}
                    {s.legalPackHash ? shortHash(s.legalPackHash, 6) : "—"}
                    {s.legalPackHash && (
                      <button
                        onClick={() => viewDocument(s.legalPackHash)}
                        className="flex items-center gap-1 font-sans text-[11px] font-medium transition-colors hover:text-hi"
                        style={{ color: "var(--brand-ink)" }}
                      >
                        <FileText className="h-3 w-3" /> Ver documento
                      </button>
                    )}
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
                  <span className="ml-auto flex items-center gap-1 text-[11px] text-low">
                    <ShieldCheck className="h-3 w-3" />
                    Honorario fijo, apruebe o rechace
                  </span>
                </div>
              )}

              {/* Aprobar solo acredita a la empresa. Publicar es el segundo
                  acto —el underwriting— y es lo que hace que un inversionista
                  llegue a ver esto en el catálogo. */}
              {s.status === "approved" && (
                <div className="mt-3.5 flex items-center gap-2 border-t border-border pt-3.5">
                  <Button
                    size="sm"
                    icon={<Send className="h-3.5 w-3.5" />}
                    onClick={() => setPublishing(s)}
                  >
                    Publicar oportunidad
                  </Button>
                  <span className="text-[11px] text-low">
                    Define plazo, tasa, garantía e hitos
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {publishing && (
        <PublishOpportunityForm
          submission={publishing}
          apiKey={apiKey}
          verifierName={name}
          onClose={() => setPublishing(null)}
          onPublished={(slug) => {
            setPublishing(null);
            setPublished(slug);
            load();
          }}
        />
      )}
    </div>
  );
}

/**
 * Sube un documento y devuelve su hash — el mismo que va en
 * `legalPackHash` al crear un expediente (hoy esa creación se hace por
 * API directa; esto es para no depender de curl para sacar el hash).
 */
function UploadWidget({ apiKey }: { apiKey: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    setHash(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/verifier/documents", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "No se pudo subir el archivo.");
        return;
      }
      const doc = (await res.json()) as { hash: string };
      setHash(doc.hash);
    } catch {
      setError("No se pudo subir el archivo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card mt-6 flex items-center gap-3 p-4">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={onFileChange}
        accept="application/pdf,image/*"
      />
      <Button
        variant="outline"
        size="sm"
        icon={<Upload className="h-3.5 w-3.5" />}
        loading={uploading}
        onClick={() => inputRef.current?.click()}
      >
        Subir legal pack
      </Button>

      {hash && (
        <span className="num flex items-center gap-1.5 text-[12px] text-mid">
          hash: {shortHash(hash, 8)}
          <button
            onClick={() => {
              navigator.clipboard?.writeText(hash);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
            className="flex items-center gap-1 font-sans transition-colors hover:text-hi"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        </span>
      )}

      {error && (
        <span className="text-[12px]" style={{ color: "var(--negative)" }}>
          {error}
        </span>
      )}

      <span className="ml-auto text-[11px] text-low">
        PDF o imagen · máx 10MB
      </span>
    </div>
  );
}
