"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useSession } from "@/lib/useSession";
import { useLayerKeys } from "@/lib/keyboard";
import { T, dialog, scrim } from "@/lib/motion";

const STEPS = [
  { key: "empresa", label: "La empresa" },
  { key: "proyecto", label: "El proyecto" },
  { key: "expediente", label: "Expediente" },
] as const;

/**
 * Overlay de nueva solicitud — se abre desde BusinessDashboard, nunca es
 * la pantalla de entrada por sí sola (ver conversación de agosto 2026:
 * loguearte no debería tirarte de una a un formulario en blanco).
 */
export function SolicitudWizard({
  address,
  onClose,
  onSubmitted,
}: {
  address: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { getAccessToken } = useSession();
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState("");
  const [companyRuc, setCompanyRuc] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Mientras envía no se puede cerrar: el expediente ya está en vuelo.
  useLayerKeys({ onEscape: () => !submitting && onClose() });

  // Cada fase se valida sola — no se puede avanzar sin completar la
  // actual, así el error aparece en el paso donde vive el campo.
  const stepValid = [Boolean(companyName), Boolean(projectTitle && requestedAmount), true];
  const canSubmit = stepValid[0] && stepValid[1];

  function goNext() {
    if (!stepValid[step]) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      // El backend deriva la wallet de este token, no del body — por eso
      // `companyWallet` ya no se manda (ver POST /api/verifier/submissions).
      const token = await getAccessToken();
      if (!token) throw new Error("Tu sesión expiró, vuelve a entrar");
      const authHeader = { Authorization: `Bearer ${token}` };

      let legalPackHash = "";
      if (file) {
        const form = new FormData();
        form.append("file", file);
        const docRes = await fetch("/api/verifier/documents", {
          method: "POST",
          headers: authHeader,
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
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          companyName,
          companyRuc,
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

  return (
    <motion.div
      variants={scrim}
      initial="hidden"
      animate="show"
      exit="exit"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
      style={{ backgroundColor: "rgba(16,24,40,0.4)" }}
      onClick={!submitting ? onClose : undefined}
    >
      <motion.div
        variants={dialog}
        initial="hidden"
        animate="show"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100vh-32px)] w-full max-w-[520px] overflow-y-auto rounded-[var(--r-card)] border border-border bg-surface shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="h2 text-[16px]">Nueva solicitud</h2>
          {!submitting && (
            <button
              onClick={onClose}
              className="focusable -mr-1 flex h-7 items-center rounded-[var(--r-input)] px-1.5 text-[12px] text-mid transition-colors hover:bg-surface-soft hover:text-hi"
            >
              Cerrar
            </button>
          )}
        </div>

        <div className="p-5">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              {/* El check verde en un círculo era el sello genérico de
                  "listo". El titular ya afirma que se envió, y el
                  `positive-soft` de relleno rompía además la regla de no
                  teñir superficies (§4). */}
              <h3 className="h3">Solicitud enviada</h3>
              <p className="max-w-[360px] text-[13px] leading-relaxed text-mid">
                Un verificador va a revisar tu expediente.
              </p>
              <Button size="lg" className="mt-2 w-full" onClick={onSubmitted}>
                Listo
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-center gap-2">
                {STEPS.map((s, i) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => i < step && setStep(i)}
                    disabled={i >= step}
                    className="flex flex-1 flex-col items-start gap-1.5"
                  >
                    <span
                      className="h-1.5 w-full rounded-full transition-colors"
                      style={{ backgroundColor: i <= step ? "var(--brand-ink)" : "var(--border)" }}
                    />
                    <span
                      className="text-[11px] font-medium"
                      style={{ color: i <= step ? "var(--text-hi)" : "var(--text-low)" }}
                    >
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.div
                    key="empresa"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={T.fast}
                    className="flex flex-col gap-4"
                  >
                    <Field
                      label="Nombre de la empresa"
                      placeholder="Textiles del Sur S.A.C."
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                      autoFocus
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
                      hint="No se puede cambiar"
                      readOnly
                      disabled
                    />
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div
                    key="proyecto"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={T.fast}
                    className="flex flex-col gap-4"
                  >
                    <Field
                      label="Título del proyecto"
                      placeholder="Compra de mercadería para temporada"
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      required
                      autoFocus
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
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="expediente"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={T.fast}
                    className="flex flex-col gap-4"
                  >
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12.5px] font-medium text-hi">
                        Expediente legal <span className="text-low">(opcional por ahora)</span>
                      </span>
                      <span className="flex items-center justify-between gap-2 rounded-[var(--r-input)] border border-border bg-surface px-3 py-2.5">
                        <span className="truncate text-[13px] text-mid">
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
                        Se guarda en storage privado; a la cadena solo va su
                        huella.
                      </span>
                    </label>

                    <div className="rounded-[var(--r-panel)] border border-border bg-surface-soft p-3 text-[12.5px]">
                      <div className="font-medium text-hi">Resumen</div>
                      <div className="mt-1.5 flex flex-col gap-1 text-mid">
                        <span>
                          {companyName || "—"}
                          {companyRuc ? ` · RUC ${companyRuc}` : ""}
                        </span>
                        <span>{projectTitle || "—"}</span>
                        <span>{requestedAmount ? `${requestedAmount} USDC` : "—"}</span>
                      </div>
                    </div>

                    {error && (
                      <div
                        className="rounded-[var(--r-panel)] border px-3 py-2.5 text-[12.5px]"
                        style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
                      >
                        {error}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-6 flex items-center gap-2.5">
                {step > 0 && (
                  <Button variant="outline" size="lg" onClick={goBack}>
                    Atrás
                  </Button>
                )}
                {step < STEPS.length - 1 ? (
                  <Button
                    size="lg"
                    className="flex-1"
                    onClick={goNext}
                    disabled={!stepValid[step]}
                  >
                    Continuar
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="flex-1"
                    onClick={handleSubmit}
                    disabled={!canSubmit || submitting}
                    loading={submitting}
                  >
                    {submitting ? "Enviando" : "Enviar solicitud"}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
