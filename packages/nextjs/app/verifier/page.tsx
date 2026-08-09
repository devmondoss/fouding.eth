"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Field, EmptyState } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { Waiting } from "@/components/ui/Waiting";
import { AccessRequests } from "@/components/verifier/AccessRequests";
import { PublishOpportunityForm } from "@/components/verifier/PublishOpportunityForm";
import { ServicingPanel } from "@/components/verifier/ServicingPanel";
import { shortHash } from "@/lib/format";
import {
  COLLATERAL_LABEL,
  PROJECT_TYPE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  declaredCoverage,
  folio,
  formatUsdcPlain,
} from "@/lib/verifier/submission";
import type { CollateralKind } from "@/lib/types";
import { T } from "@/lib/motion";
import type { VerifierSubmission } from "@/lib/verifier/types";

/**
 * Panel interno del verificador. Deliberadamente FUERA del módulo único
 * del inversionista (docs/design-system.md §6) — esto no es parte del
 * producto que ve un inversionista, es herramienta operativa. No usa
 * `useSession`/Privy: se protege con la API key de
 * `lib/verifier/auth.ts`, guardada en localStorage de este navegador.
 */

const KEY_STORAGE = "founding.verifier.apiKey";
const NAME_STORAGE = "founding.verifier.name";

/* Las etiquetas y tonos de estado viven en lib/verifier/submission.ts —
   los mismos que ve la empresa en su panel. Cuando estaban duplicados
   acá, "Pendiente" de un lado convivía con "En cola" del otro para la
   misma fila de base de datos.

   La píldora también se reimplementaba a mano, con su propio borde y su
   propio color, mientras `Pill` ya existía y este mismo directorio la
   importaba en AccessRequests. */

/* Cuatro trabajos distintos que estaban apilados como iguales en una sola
   columna. Son secciones, no una lista: el operador hace uno a la vez. */
const SECCIONES = [
  { key: "cola", label: "Cola de expedientes" },
  { key: "acceso", label: "Acceso de inversionistas" },
  { key: "servicing", label: "Servicing" },
  { key: "documentos", label: "Documentos" },
] as const;

type Seccion = (typeof SECCIONES)[number]["key"];

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
      <main
        className="flex min-h-screen items-center justify-center px-5"
        style={{ backgroundColor: "var(--bg)" }}
      >
        <div className="card w-full max-w-[380px] p-6">
          <h1 className="h2 text-[17px]">Panel del verificador</h1>
          <p className="mt-1.5 text-[12.5px] text-mid">
            Acceso interno — pide la API key al equipo.
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
      </main>
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
  const [seccion, setSeccion] = useState<Seccion>("cola");
  /** Decisión pendiente de confirmar: expediente y sentido. */
  const [deciding, setDeciding] = useState<{
    s: VerifierSubmission;
    approve: boolean;
  } | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);

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

  /**
   * Aprobar mintea un pasaporte soulbound onchain y rechazar cierra el
   * expediente: las dos son irreversibles y ninguna pedía confirmación.
   * Y el rechazo exige motivo — la API ya aceptaba `note` y el dashboard de
   * la empresa le promete al dueño que puede "corregir lo observado", una
   * promesa que nadie podía cumplir porque no había dónde escribirla.
   */
  async function decide(id: string, approve: boolean, note: string) {
    setBusyId(id);
    setDecisionError(null);
    try {
      const res = await fetch(`/api/verifier/submissions/${id}/decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ approve, decidedBy: name, note: note || undefined }),
      });

      // `if (res.ok) await load()` se tragaba en silencio un 502 del sync de
      // passport: el spinner paraba, nada cambiaba, nada se decía.
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error ??
            (res.status === 401
              ? "API key inválida o expirada."
              : `La decisión no se registró (HTTP ${res.status}).`),
        );
      }

      setDeciding(null);
      await load();
    } catch (cause) {
      setDecisionError(
        cause instanceof Error
          ? cause.message
          : "La decisión no se pudo registrar.",
      );
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Tomar el expediente antes de decidirlo. Un paso más, a propósito: es
   * lo que le pone nombre y hora a la revisión del lado de la empresa,
   * que hasta ahora veía "Pendiente" hasta que aparecía un veredicto de
   * la nada.
   */
  async function claim(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/verifier/submissions/${id}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ reviewer: name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "No se pudo tomar el expediente");
      }
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo tomar el expediente",
      );
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

  // Trabajo abierto: lo que está en cola más lo que alguien ya tomó y
  // todavía no decidió. Contar solo `pending` escondía los expedientes
  // tomados y olvidados, que son justamente los que se vencen.
  const pendientes =
    submissions?.filter((s) => s.status === "pending" || s.status === "in_review")
      .length ?? 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      {/* Antes no había cabecera ni landmark: un h1 dentro de un div, y las
          cuatro herramientas debajo como hermanas de igual peso. */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[var(--w-doc)] items-center justify-between px-6 py-4">
          <div>
            <h1 className="h1 text-[20px]">Panel del verificador</h1>
            <p className="mt-0.5 text-[12.5px] text-mid">
              Conectado como {name}
              {pendientes > 0 && (
                <>
                  {" · "}
                  <span className="num font-medium text-hi">{pendientes}</span>{" "}
                  {pendientes === 1 ? "expediente" : "expedientes"} por revisar
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              Actualizar
            </Button>
            <Button variant="ghost" size="sm" onClick={onLock}>
              Salir
            </Button>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Secciones del panel"
          className="mx-auto flex max-w-[var(--w-doc)] gap-1 overflow-x-auto px-6"
        >
          {SECCIONES.map((s) => {
            const on = seccion === s.key;
            return (
              <button
                key={s.key}
                role="tab"
                aria-selected={on}
                onClick={() => setSeccion(s.key)}
                className="focusable relative shrink-0 whitespace-nowrap px-3 py-2.5 text-[13px] transition-colors"
                style={{
                  color: on ? "var(--brand-ink)" : "var(--text-mid)",
                  fontWeight: on ? 600 : 400,
                }}
              >
                {s.label}
                {s.key === "cola" && pendientes > 0 && (
                  <span className="num ml-1.5 text-[11px]" style={{ color: "var(--warning)" }}>
                    {pendientes}
                  </span>
                )}
                {on && (
                  <motion.span
                    layoutId="verifier-underline"
                    transition={T.indicator}
                    className="absolute inset-x-2 -bottom-px h-[2px] rounded-full"
                    style={{ backgroundColor: "var(--brand-ink)" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </header>

      <main className="mx-auto max-w-[var(--w-doc)] px-6 py-7">
        {seccion === "documentos" && <UploadWidget apiKey={apiKey} />}
        {seccion === "acceso" && <AccessRequests apiKey={apiKey} />}
        {seccion === "servicing" && <ServicingPanel apiKey={apiKey} />}

        {seccion === "cola" && (
          <>
        {published && (
          <div
            className="mt-4 flex items-center gap-1.5 rounded-[var(--r-panel)] border px-4 py-3 text-[13px]"
            style={{ borderColor: "var(--positive)", color: "var(--positive)" }}
          >
            Publicada en el catálogo como <span className="num">{published}</span>
            <button
              onClick={() => setPublished(null)}
              className="ml-auto text-[12px] text-mid transition-colors hover:text-hi"
            >
              Cerrar
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {loading && !submissions && <Waiting label="Cargando la cola" />}

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
                  <div className="num text-[11px] text-low">{folio(s.id)}</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <h3 className="h3">{s.projectTitle}</h3>
                    <Pill
                      label={STATUS_LABEL[s.status]}
                      tone={STATUS_TONE[s.status]}
                      dot
                    />
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-mid">
                    {s.companyName} {s.companyRuc && `· RUC ${s.companyRuc}`}
                    {s.sector && ` · ${s.sector}`}
                    {s.city && `, ${s.city}`}
                  </p>
                  <p className="num mt-1.5 flex items-center gap-1.5 text-[11.5px] text-low">
                    {shortHash(s.companyWallet, 6)} · hash{" "}
                    {s.legalPackHash ? shortHash(s.legalPackHash, 6) : "—"}
                    {s.legalPackHash && (
                      <button
                        onClick={() => viewDocument(s.legalPackHash)}
                        className="focusable font-sans text-[11px] font-medium underline decoration-dotted transition-colors hover:text-hi"
                        style={{ color: "var(--brand-ink)" }}
                      >
                        Ver documento
                      </button>
                    )}
                  </p>
                  {s.reviewer && s.status === "in_review" && (
                    <p className="mt-1.5 text-[11.5px] text-mid">
                      Tomado por {s.reviewer}
                    </p>
                  )}
                  {s.note && (
                    <p className="mt-1.5 text-[12px] text-mid">Nota: {s.note}</p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <div className="num text-[15px] font-semibold text-hi">
                    {formatUsdcPlain(s.requestedAmount)}
                  </div>
                  <div className="text-[11px] text-low">USDC solicitados</div>
                </div>
              </div>

              {/* Lo que hay que revisar, en la tarjeta: antes había que
                  decidir con nombre, RUC y un monto suelto. */}
              <Expediente submission={s} />

              {s.status === "pending" && (
                <div className="mt-3.5 flex items-center gap-2 border-t border-border pt-3.5">
                  <Button size="sm" loading={busyId === s.id} onClick={() => claim(s.id)}>
                    Tomar revisión
                  </Button>
                  <span className="text-[11px] text-low">
                    La empresa verá tu nombre y desde cuándo lo revisas
                  </span>
                </div>
              )}

              {s.status === "in_review" && (
                <div className="mt-3.5 flex gap-2 border-t border-border pt-3.5">
                  {/* La línea sobre el honorario fijo era un argumento de
                      venta al lado de dos botones de decisión: el operador ya
                      sabe cómo cobra. Vive en /negocios, que es donde
                      convence a alguien. */}
                  <Button
                    size="sm"
                    loading={busyId === s.id}
                    onClick={() => {
                      setDecisionNote("");
                      setDecisionError(null);
                      setDeciding({ s, approve: true });
                    }}
                  >
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busyId === s.id}
                    onClick={() => {
                      setDecisionNote("");
                      setDecisionError(null);
                      setDeciding({ s, approve: false });
                    }}
                  >
                    Rechazar
                  </Button>
                </div>
              )}

              {/* Aprobar solo acredita a la empresa. Publicar es el segundo
                  acto —el underwriting— y es lo que hace que un inversionista
                  llegue a ver esto en el catálogo. */}
              {s.status === "approved" && (
                <div className="mt-3.5 border-t border-border pt-3.5">
                  <Button size="sm" onClick={() => setPublishing(s)}>
                    Publicar oportunidad
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
          </>
        )}
      </main>

      {/* Aprobar mintea un pasaporte soulbound; rechazar cierra el
          expediente. Las dos eran de un clic y sin vuelta atrás. */}
      <Modal
        open={deciding !== null}
        onClose={() => setDeciding(null)}
        title={
          deciding?.approve
            ? "Aprobar el expediente"
            : "Rechazar el expediente"
        }
        subtitle={deciding ? `${deciding.s.projectTitle} — ${deciding.s.companyName}` : undefined}
        width={480}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeciding(null)}>
              Cancelar
            </Button>
            <Button
              variant={deciding?.approve ? "primary" : "danger"}
              loading={busyId === deciding?.s.id}
              disabled={!deciding?.approve && decisionNote.trim().length < 10}
              onClick={() =>
                deciding &&
                decide(deciding.s.id, deciding.approve, decisionNote.trim())
              }
            >
              {deciding?.approve ? "Aprobar y emitir pasaporte" : "Rechazar"}
            </Button>
          </>
        }
      >
        {/* Lo que hace falta saber antes de pulsar es que no hay vuelta
            atrás. Cómo funciona un token soulbound no cambia la decisión. */}
        <p className="text-[13px] leading-relaxed text-mid">
          {deciding?.approve
            ? "Emite el pasaporte de esta empresa onchain. No se revierte."
            : "El motivo se le muestra al dueño del negocio."}
        </p>

        <div className="mt-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-hi">
              {deciding?.approve
                ? "Nota interna (opcional)"
                : "Motivo del rechazo"}
            </span>
            <textarea
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              rows={4}
              placeholder={
                deciding?.approve
                  ? "Qué se verificó y contra qué documento."
                  : "Qué falta o qué no cuadra, en términos que el dueño pueda accionar."
              }
              className="w-full resize-y rounded-[var(--r-input)] border border-border bg-surface px-3 py-2 text-[13px] leading-relaxed text-hi outline-none transition-colors focus:border-[var(--brand-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-ink)]"
            />
            {!deciding?.approve && (
              <span className="text-[11.5px] text-low">
                Obligatorio · mínimo 10 caracteres
              </span>
            )}
          </label>
        </div>

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
 * El legajo que la empresa declaró, en la tarjeta de la cola. No es un
 * adorno: es exactamente lo que hay que contrastar (RUC contra SUNAT,
 * ventas contra comprobantes, garantía contra registro) y lo que después
 * llega prellenado al formulario de publicación.
 *
 * La cobertura se muestra como "declarada" a propósito — el número que
 * decide el crédito es el valor neto recuperable, que sale del castigo
 * por tipo de activo que aplica este mismo panel al publicar.
 */
function Expediente({ submission: s }: { submission: VerifierSubmission }) {
  const coverage = declaredCoverage(s.collateralValue, s.requestedAmount);
  const hasLegajo = Boolean(s.projectType || s.collateralKind || s.useOfFunds);
  if (!hasLegajo) return null;

  return (
    <div className="mt-3.5 border-t border-border pt-3.5">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        <Dato label="Tipo" value={PROJECT_TYPE_LABEL[s.projectType] ?? "—"} />
        <Dato
          label="Plazo pedido"
          value={s.termMonths ? `${s.termMonths} meses` : "—"}
        />
        <Dato
          label="Antigüedad"
          value={s.yearsOperating ? `${s.yearsOperating} años` : "—"}
        />
        <Dato
          label="Ventas declaradas"
          value={s.annualRevenue ? `${formatUsdcPlain(s.annualRevenue)} USDC` : "—"}
        />
        <Dato
          label="Garantía"
          value={COLLATERAL_LABEL[s.collateralKind as CollateralKind] ?? "—"}
        />
        <Dato
          label="Valor declarado"
          value={
            s.collateralValue ? `${formatUsdcPlain(s.collateralValue)} USDC` : "—"
          }
        />
        <Dato
          label="Cobertura declarada"
          value={coverage ? `${coverage.toFixed(2)}x` : "—"}
          accent={coverage !== null && coverage < 1.2 ? "var(--warning)" : undefined}
        />
        <Dato label="Documento" value={s.legalPackName || "Sin adjuntar"} />
      </div>

      {s.useOfFunds && (
        <p className="mt-3 text-[12px] leading-relaxed text-mid">
          <span className="text-low">Destino del capital · </span>
          {s.useOfFunds}
        </p>
      )}
      {s.collateralDetail && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-mid">
          <span className="text-low">Activo · </span>
          {s.collateralDetail}
        </p>
      )}
    </div>
  );
}

function Dato({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <div
        className="num mt-0.5 truncate text-[12.5px] font-medium"
        style={{ color: accent ?? "var(--text-hi)" }}
        title={value}
      >
        {value}
      </div>
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
            className="focusable font-sans text-[11.5px] font-medium underline decoration-dotted transition-colors hover:text-hi"
          >
            {copied ? "Copiado" : "Copiar"}
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
