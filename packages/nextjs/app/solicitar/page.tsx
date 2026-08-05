"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState, Field } from "@/components/ui/Field";

/**
 * Cara pública del lado del originador — deliberadamente FUERA del
 * módulo único del inversionista (design-system.md §6), igual que
 * app/verifier: esta no es una pantalla que un inversionista navegue,
 * es la puerta de entrada para que una empresa mande su expediente.
 *
 * Llama las mismas rutas que ya construimos para el panel del
 * verificador (/api/verifier/submissions, /api/verifier/documents),
 * pero sin la API key — esas dos rutas están abiertas a propósito para
 * esto, protegidas solo por rate limit (ver lib/verifier/auth.ts).
 * El resto del backend del verificador (listar, decidir, descargar)
 * sigue exigiendo la key: esta página nunca los toca.
 */
export default function SolicitarPage() {
  const [companyName, setCompanyName] = useState("");
  const [companyRuc, setCompanyRuc] = useState("");
  const [companyWallet, setCompanyWallet] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const walletError =
    companyWallet && !/^0x[a-fA-F0-9]{40}$/.test(companyWallet)
      ? "No tiene forma de dirección EVM (0x...)"
      : null;

  const canSubmit =
    companyName && companyWallet && !walletError && projectTitle && requestedAmount;

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
          companyWallet,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo falló, intenta de nuevo");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[520px] items-center px-5 py-12">
        <EmptyState
          title="Solicitud enviada"
          detail="Un verificador va a revisar tu expediente. Si tu wallet queda habilitada, tu operación se publica en el marketplace."
          action={
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: "var(--positive)" }}>
              <CheckCircle2 className="h-4 w-4" />
              Recibido
            </span>
          }
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[560px] px-5 py-12">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-low">
        Para empresas
      </div>
      <h1 className="h1 mt-1.5">Solicita financiamiento</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-mid">
        Cuenta tu proyecto y sube tu expediente legal. Un verificador humano
        revisa la solicitud antes de publicarla — nada se ofrece a
        inversionistas sin pasar por esa revisión.
      </p>

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
          placeholder="0x..."
          value={companyWallet}
          onChange={(e) => setCompanyWallet(e.target.value)}
          error={walletError}
          hint="Es la wallet que quedará habilitada para recibir el capital si se aprueba"
          required
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

        <Button
          type="submit"
          size="lg"
          disabled={!canSubmit || submitting}
          loading={submitting}
        >
          {submitting ? "Enviando" : "Enviar solicitud"}
        </Button>
      </form>
    </main>
  );
}
