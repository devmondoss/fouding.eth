"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, LogOut, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState, Field } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { useSession } from "@/lib/useSession";
import { shortHash } from "@/lib/format";
import type { VerifierSubmission } from "@/lib/verifier/types";

/**
 * Cara pública del lado del originador — deliberadamente FUERA del
 * módulo único del inversionista (design-system.md §6), igual que
 * app/verifier: esta no es una pantalla que un inversionista navegue,
 * es la puerta de entrada para que una empresa mande su expediente.
 *
 * Gateado con el mismo login de Privy que el lado inversionista — cero
 * infraestructura nueva de auth, la wallet de la empresa se crea
 * automático igual que la del inversionista. La wallet logueada es la
 * que queda en `companyWallet`, de solo lectura: es la que
 * IdentityRegistry va a habilitar si se aprueba, así que no tiene
 * sentido dejarla editable a mano.
 *
 * Llama las mismas rutas que ya construimos para el panel del
 * verificador (/api/verifier/submissions, /api/verifier/documents),
 * pero sin la API key — esas dos rutas (más /submissions/mine, para
 * ver el estado) están abiertas a propósito para esto, protegidas
 * solo por rate limit (ver lib/verifier/auth.ts). El resto del backend
 * del verificador (listar todo, decidir, descargar documentos) sigue
 * exigiendo la key: esta página nunca los toca.
 */

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

export default function SolicitarPage() {
  const { session, connectWallet, connecting, connectError, signOut } = useSession();

  if (session === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-[var(--brand-ink)]" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="card max-w-[400px] p-6 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-low">
            Para empresas
          </div>
          <h1 className="h2 mt-1.5">Solicita financiamiento</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-mid">
            Inicia sesión con tu correo para enviar tu expediente. Se crea una
            wallet automáticamente — es la que va a quedar habilitada para
            recibir el capital si se aprueba.
          </p>
          <Button
            className="mt-4 w-full"
            size="lg"
            loading={connecting}
            onClick={connectWallet}
          >
            {connecting ? "Conectando" : "Iniciar sesión"}
          </Button>
          {connectError && (
            <p className="mt-2 text-[12px]" style={{ color: "var(--negative)" }}>
              {connectError}
            </p>
          )}
        </div>
      </main>
    );
  }

  return <SolicitarForm address={session.address} onSignOut={signOut} />;
}

function SolicitarForm({
  address,
  onSignOut,
}: {
  address: string;
  onSignOut: () => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [companyRuc, setCompanyRuc] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [mine, setMine] = useState<VerifierSubmission[] | null>(null);

  useEffect(() => {
    fetch(`/api/verifier/submissions/mine?wallet=${address}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setMine)
      .catch(() => setMine([]));
  }, [address, done]);

  const canSubmit = companyName && projectTitle && requestedAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      let legalPackHash = "";
      if (file) {
        const form = new FormData();
        form.append("file", file);
        const docRes = await fetch("/api/verifier/documents", {
          method: "POST",
          body: form,
        });
        if (!docRes.ok) {
          const body = await docRes.json().catch(() => null);
          throw new Error(body?.error ?? "No se pudo subir el documento");
        }
        const doc = await docRes.json();
        legalPackHash = doc.hash;
      }

      const res = await fetch("/api/verifier/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          companyRuc,
          companyWallet: address,
          projectTitle,
          requestedAmount,
          legalPackHash,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "No se pudo enviar la solicitud");
      }

      setDone(true);
      setCompanyName("");
      setCompanyRuc("");
      setProjectTitle("");
      setRequestedAmount("");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo falló, intenta de nuevo");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-[560px] px-5 py-12">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-low">
            Para empresas
          </div>
          <h1 className="h1 mt-1.5">Solicita financiamiento</h1>
        </div>
        <button
          onClick={onSignOut}
          className="flex shrink-0 items-center gap-1.5 rounded-[var(--r-input)] border border-border px-2.5 py-1.5 text-[12px] text-mid hover:bg-surface-soft"
        >
          <LogOut className="h-3 w-3" />
          {shortHash(address)}
        </button>
      </div>
      <p className="mt-2 text-[13.5px] leading-relaxed text-mid">
        Cuenta tu proyecto y sube tu expediente legal. Un verificador humano
        revisa la solicitud antes de publicarla — nada se ofrece a
        inversionistas sin pasar por esa revisión.
      </p>

      {mine && mine.length > 0 && (
        <div className="card mt-6 p-4">
          <div className="label">Tus solicitudes</div>
          <div className="mt-2 flex flex-col gap-2">
            {mine.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 border-b border-border py-1.5 text-[13px] last:border-0 last:pb-0"
              >
                <span className="truncate text-hi">{s.projectTitle}</span>
                <Pill label={STATUS_LABEL[s.status]} tone={STATUS_TONE[s.status]} dot />
              </div>
            ))}
          </div>
        </div>
      )}

      {done ? (
        <div className="mt-6">
          <EmptyState
            title="Solicitud enviada"
            detail="Un verificador va a revisar tu expediente. Si tu wallet queda habilitada, tu operación se publica en el marketplace."
            action={
              <span
                className="flex items-center gap-1.5 text-[12.5px] font-medium"
                style={{ color: "var(--positive)" }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Recibido
              </span>
            }
          />
          <Button className="mt-4 w-full" variant="outline" onClick={() => setDone(false)}>
            Enviar otra solicitud
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card mt-6 flex flex-col gap-4 p-5">
          <Field
            label="Nombre de la empresa"
            placeholder="Textiles del Sur S.A.C."
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />
          <Field
            label="RUC"
            placeholder="20123456789"
            value={companyRuc}
            onChange={(e) => setCompanyRuc(e.target.value)}
          />
          <Field
            label="Wallet de la empresa"
            value={address}
            hint="La wallet con la que iniciaste sesión — es la que queda habilitada si se aprueba"
            readOnly
            disabled
          />
          <Field
            label="Título del proyecto"
            placeholder="Compra de mercadería para temporada"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            required
          />
          <Field
            label="Monto solicitado"
            suffix="USDC"
            inputMode="decimal"
            placeholder="50000"
            value={requestedAmount}
            onChange={(e) => setRequestedAmount(e.target.value)}
            required
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-hi">
              Expediente legal <span className="text-low">(opcional por ahora)</span>
            </span>
            <span className="flex items-center justify-between gap-2 rounded-[var(--r-input)] border border-border bg-surface px-3 py-2.5">
              <span className="flex items-center gap-2 truncate text-[13px] text-mid">
                <Upload className="h-3.5 w-3.5 shrink-0 text-low" />
                {file ? file.name : "Ningún archivo seleccionado"}
              </span>
              <span
                className="shrink-0 text-[12px] font-medium underline decoration-dotted"
                style={{ color: "var(--brand-ink)" }}
              >
                Elegir
              </span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </span>
            <span className="text-[12px] text-low">
              El documento se guarda en storage privado — a la plataforma solo
              llega su hash, nunca el archivo en sí.
            </span>
          </label>

          {error && (
            <div
              className="rounded-[var(--r-panel)] border px-3 py-2.5 text-[12.5px]"
              style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
            >
              {error}
            </div>
          )}

          <Button type="submit" size="lg" disabled={!canSubmit || submitting} loading={submitting}>
            {submitting ? "Enviando" : "Enviar solicitud"}
          </Button>
        </form>
      )}
    </main>
  );
}
