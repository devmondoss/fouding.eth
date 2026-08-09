"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ChipChoice, ChoiceGroup } from "@/components/ui/Choice";
import {
  SubmissionReceipt,
  type ReceiptModel,
} from "@/components/flow/SubmissionReceipt";
import { useSession } from "@/lib/useSession";
import { useLayerKeys } from "@/lib/keyboard";
import { T } from "@/lib/motion";
import {
  AMOUNT_PRESETS,
  COLLATERAL_DETAIL,
  COLLATERAL_KINDS,
  COLLATERAL_LABEL,
  MIN_REQUESTED_USDC,
  PROJECT_TYPES,
  REVIEW_SLA_DAYS,
  TERM_PRESETS,
  amountError,
  formatUsdcPlain,
  parseAmount,
} from "@/lib/verifier/submission";
import type { CollateralKind } from "@/lib/types";
import type { Company } from "@/lib/verifier/companies";

/**
 * Tres pasos, no cuatro. El de "La empresa" se fue: esos datos —RUC,
 * sector, ciudad, años de operación— ya los verificó alguien cuando se
 * acreditó la empresa, y volvían a pedirse en cada proyecto. Ahora la
 * solicitud es solo la solicitud.
 */
const STEPS = [
  { key: "proyecto", label: "El proyecto" },
  { key: "condiciones", label: "Lo que pides" },
  { key: "expediente", label: "Documentación" },
] as const;

/**
 * Overlay de nueva solicitud — se abre desde BusinessDashboard, nunca es
 * la pantalla de entrada por sí sola (ver conversación de agosto 2026:
 * loguearte no debería tirarte de una a un formulario en blanco).
 *
 * Pedía cuatro datos y mandaba a revisión un papel que no alcanzaba para
 * decidir nada: sin plazo, sin destino del capital, sin garantía, con un
 * monto libre que podía ser 200 dólares. Ahora el asistente levanta el
 * legajo completo —empresa, proyecto, condiciones y documentación— y el
 * último paso muestra el comprobante de lo que se está enviando, con lo
 * que la plataforma todavía NO promete escrito al pie.
 */
export function SolicitudWizard({
  empresa,
  onClose,
  onSubmitted,
}: {
  /** La empresa ya acreditada que pide. Sus datos no se vuelven a
   * teclear: se muestran en el comprobante y viajan desde el servidor. */
  empresa: Company;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { getAccessToken } = useSession();
  const [step, setStep] = useState(0);
  /** Un paso muestra sus errores recién cuando se intentó avanzar: hasta
   * ahí el formulario no le grita a alguien que todavía está tecleando. */
  const [attempted, setAttempted] = useState<boolean[]>([false, false, false]);

  const [projectType, setProjectType] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState("");
  const [useOfFunds, setUseOfFunds] = useState("");

  const [amountChoice, setAmountChoice] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [termMonths, setTermMonths] = useState<string | null>("12");
  const [collateralKind, setCollateralKind] = useState<CollateralKind | null>(null);
  const [collateralValue, setCollateralValue] = useState("");
  const [collateralDetail, setCollateralDetail] = useState("");

  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Mientras envía no se puede cerrar: el expediente ya está en vuelo.
  useLayerKeys({ onEscape: () => !submitting && onClose() });

  const requestedAmount =
    amountChoice === "custom" ? customAmount : (amountChoice ?? "");

  const errors = useMemo(
    () => ({
      projectType: projectType ? null : "Elige para qué es el capital",
      projectTitle: projectTitle.trim() ? null : "Ponle un título al proyecto",
      useOfFunds:
        useOfFunds.trim().length >= 40
          ? null
          : "Cuenta en qué se gasta el capital — al menos un par de líneas",
      amount: amountError(requestedAmount),
      term: termMonths ? null : "Elige un plazo",
      collateralKind: collateralKind ? null : "Elige el activo que ofreces",
      collateralValue: (() => {
        const n = parseAmount(collateralValue);
        if (!Number.isFinite(n) || n <= 0) return "Valor estimado del activo";
        return null;
      })(),
    }),
    [
      projectType,
      projectTitle,
      useOfFunds,
      requestedAmount,
      termMonths,
      collateralKind,
      collateralValue,
    ],
  );

  const stepErrors: (string | null)[][] = [
    [errors.projectType, errors.projectTitle, errors.useOfFunds],
    [errors.amount, errors.term, errors.collateralKind, errors.collateralValue],
    [],
  ];
  const stepValid = stepErrors.map((list) => list.every((e) => e === null));
  const canSubmit = stepValid[0] && stepValid[1];

  /** El error solo se pinta si ya se intentó pasar de ese paso. */
  const show = (index: number, message: string | null) =>
    attempted[index] ? message : null;

  const receipt: ReceiptModel = {
    companyName: empresa.name,
    companyRuc: empresa.ruc,
    companyWallet: empresa.wallet,
    sector: empresa.sector,
    city: empresa.city,
    yearsOperating: empresa.yearsOperating,
    annualRevenue: empresa.annualRevenue,
    projectTitle,
    projectType: projectType ?? "",
    useOfFunds,
    requestedAmount,
    termMonths: termMonths ?? "",
    collateralKind: collateralKind ?? "",
    collateralValue,
    collateralDetail,
    legalPackName: file?.name ?? null,
    legalPackHash: null,
  };

  function goNext() {
    setAttempted((prev) => prev.map((v, i) => (i === step ? true : v)));
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
        // Sin datos de empresa: el servidor los toma de la fila acreditada
        // (ver POST /api/verifier/submissions). Mandarlos desde acá
        // permitía declarar en cada proyecto un RUC distinto del verificado.
        body: JSON.stringify({
          projectTitle: projectTitle.trim(),
          projectType,
          useOfFunds: useOfFunds.trim(),
          requestedAmount: String(parseAmount(requestedAmount)),
          termMonths: Number(termMonths) || 0,
          collateralKind,
          collateralValue: String(parseAmount(collateralValue)),
          collateralDetail: collateralDetail.trim(),
          legalPackHash,
          legalPackName: file?.name ?? "",
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
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "var(--bg)" }}>
      {/* Módulo, no modal. Armar un expediente no es una interrupción de
          otra cosa: es EL trabajo del dueño de negocio, con cuatro pasos,
          un legajo entero y un comprobante al final. Encerrado en 580px
          flotantes obligaba a hacer scroll dentro de una caja mientras el
          panel de atrás se veía por los bordes —y con Escape se perdía lo
          tecleado—. Acá tiene su URL (/solicitar/nueva) y su pantalla. */}
      <header
        className="sticky top-0 z-10 border-b border-border"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <div className="mx-auto flex w-full max-w-[var(--w-doc)] items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
          <div className="min-w-0">
            <h1 className="h2 text-[16px]">Nueva solicitud de financiamiento</h1>
            {!done && (
              <p className="num mt-0.5 text-[12px] text-low">
                Paso {step + 1} de {STEPS.length}
              </p>
            )}
          </div>
          {!submitting && !done && (
            <button
              onClick={onClose}
              className="focusable -mr-1 flex h-8 shrink-0 items-center rounded-[var(--r-input)] px-2 text-[12.5px] text-mid transition-colors hover:bg-surface-soft hover:text-hi"
            >
              Descartar
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[var(--w-doc)] flex-1 px-5 py-6 sm:px-6 sm:py-8">
          {done ? (
            <Submitted onDone={onSubmitted} />
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
                      style={{
                        backgroundColor:
                          i <= step ? "var(--brand-strong)" : "var(--border)",
                      }}
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
                  <Step key="proyecto">
                    <ChoiceGroup
                      label="¿Para qué es el capital?"
                      options={PROJECT_TYPES.map((t) => ({
                        value: t.key,
                        label: t.label,
                        detail: t.detail,
                      }))}
                      value={projectType}
                      onChange={setProjectType}
                      error={show(0, errors.projectType)}
                    />

                    <Field
                      label="Título del proyecto"
                      placeholder="Compra de mercadería para temporada alta"
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      error={show(0, errors.projectTitle)}
                    />

                    <TextArea
                      label="Destino del capital"
                      rows={4}
                      value={useOfFunds}
                      onChange={setUseOfFunds}
                      placeholder="Dos secadoras industriales cotizadas con un proveedor de Lima, instalación en planta y capital de trabajo para el primer lote. Ya hay orden de compra de dos clientes."
                      error={show(0, errors.useOfFunds)}
                      hint="En qué se gasta y contra qué pedido"
                    />
                  </Step>
                )}

                {step === 1 && (
                  <Step key="condiciones">
                    <ChipChoice
                      label="Monto solicitado"
                      options={[
                        ...AMOUNT_PRESETS.map((n) => ({
                          value: String(n),
                          label: `${formatUsdcPlain(n)} USDC`,
                        })),
                        { value: "custom", label: "Otro monto" },
                      ]}
                      value={amountChoice}
                      onChange={setAmountChoice}
                      error={show(1, errors.amount)}
                      hint={`Mínimo ${formatUsdcPlain(MIN_REQUESTED_USDC)} USDC`}
                      footer={
                        amountChoice === "custom" ? (
                          <div className="mt-1">
                            <Field
                              label="Monto exacto"
                              suffix="USDC"
                              inputMode="decimal"
                              placeholder="75000"
                              value={customAmount}
                              onChange={(e) => setCustomAmount(e.target.value)}
                              autoFocus
                            />
                          </div>
                        ) : null
                      }
                    />

                    <ChipChoice
                      label="Plazo de repago"
                      options={TERM_PRESETS.map((m) => ({
                        value: String(m),
                        label: `${m} meses`,
                      }))}
                      value={termMonths}
                      onChange={setTermMonths}
                      error={show(1, errors.term)}
                      hint="Referencial: el definitivo lo fija el verificador"
                    />

                    <ChoiceGroup
                      label="Garantía que ofreces"
                      options={COLLATERAL_KINDS.map((k) => ({
                        value: k,
                        label: COLLATERAL_LABEL[k],
                        detail: COLLATERAL_DETAIL[k],
                      }))}
                      value={collateralKind}
                      onChange={setCollateralKind}
                      error={show(1, errors.collateralKind)}
                    />

                    <Field
                      label="Valor estimado del activo"
                      suffix="USDC"
                      inputMode="decimal"
                      placeholder="90000"
                      value={collateralValue}
                      onChange={(e) => setCollateralValue(e.target.value)}
                      error={show(1, errors.collateralValue)}
                      hint="Tu estimación. El verificador lo tasa y le aplica un castigo por tipo de activo."
                    />

                    <TextArea
                      label="Descripción del activo"
                      optional
                      rows={2}
                      value={collateralDetail}
                      onChange={setCollateralDetail}
                      placeholder="Secadora industrial marca X, año 2021, partida registral si la tienes a mano."
                    />
                  </Step>
                )}

                {step === 2 && (
                  <Step key="expediente">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12.5px] font-medium text-hi">
                        Expediente legal <span className="text-low">(opcional)</span>
                      </span>
                      <span className="flex items-center justify-between gap-2 rounded-[var(--r-input)] border border-border bg-surface px-3 py-2.5">
                        <span className="truncate text-[13px] text-mid">
                          {file ? file.name : "Ningún archivo seleccionado"}
                        </span>
                        <span
                          className="shrink-0 text-[12px] font-medium underline decoration-dotted"
                          style={{ color: "var(--brand-ink)" }}
                        >
                          {file ? "Cambiar" : "Elegir"}
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="application/pdf,image/*"
                          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />
                      </span>
                      <span className="text-[12px] text-low">
                        Vigencia de poderes, ficha RUC, comprobantes de venta o la
                        tasación del activo, en un PDF. Puedes enviarlo sin adjuntar
                        nada: el verificador te lo pedirá si le hace falta. El
                        documento se guarda en storage privado — a la cadena solo
                        llega su hash, nunca el archivo.
                      </span>
                    </label>

                    <SubmissionReceipt model={receipt} dense />

                    <div className="rounded-[var(--r-panel)] border border-border p-3">
                      <div className="label">Qué pasa cuando envíes</div>
                      <ol className="mt-2 flex flex-col gap-2">
                        <NextStep n={1} title="Entra a la cola de revisión">
                          Queda con folio propio y visible en tu panel.
                        </NextStep>
                        <NextStep n={2} title="Un verificador lo toma">
                          Vas a ver su nombre y desde cuándo lo está revisando.
                        </NextStep>
                        <NextStep
                          n={3}
                          title={`Resultado en ${REVIEW_SLA_DAYS} días hábiles`}
                        >
                          Si aprueba, se emite tu pasaporte de negocio onchain. Si
                          rechaza, te deja por escrito qué corregir.
                        </NextStep>
                        <NextStep n={4} title="Publicación al catálogo">
                          Con el expediente aprobado, el verificador fija plazo,
                          rentabilidad e hitos, y recién ahí los inversionistas
                          pueden financiarlo.
                        </NextStep>
                      </ol>
                    </div>

                    {error && (
                      <div
                        role="alert"
                        className="rounded-[var(--r-panel)] border px-3 py-2.5 text-[12.5px]"
                        style={{
                          borderColor: "var(--negative)",
                          color: "var(--negative)",
                        }}
                      >
                        {error}
                      </div>
                    )}
                  </Step>
                )}
              </AnimatePresence>
            </>
          )}
      </main>

      {/* Las acciones quedan ancladas abajo: con el legajo entero en
          pantalla, "Continuar" no puede estar al final de un scroll. */}
      {!done && (
        <div
          className="sticky bottom-0 border-t border-border"
          style={{ backgroundColor: "var(--surface)" }}
        >
          <div className="mx-auto flex w-full max-w-[var(--w-doc)] items-center gap-2.5 px-5 py-3.5 sm:px-6">
            {step > 0 && (
              <Button variant="outline" size="lg" onClick={goBack} disabled={submitting}>
                Atrás
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button size="lg" className="flex-1" onClick={goNext}>
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
                Enviar a revisión
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={T.fast}
      className="flex flex-col gap-4"
    >
      {children}
    </motion.div>
  );
}

function NextStep({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-2.5">
      <span
        className="num mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
        style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand-ink)" }}
      >
        {n}
      </span>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-hi">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-mid">
          {children}
        </span>
      </span>
    </li>
  );
}

function Submitted({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      {/* El check verde en un círculo era el sello genérico de "listo". El
          titular ya afirma que se envió, y el `positive-soft` de relleno
          rompía además la regla de no teñir superficies (§4). */}
      <h3 className="h3">Expediente enviado a revisión</h3>
      <p className="max-w-[380px] text-[13px] leading-relaxed text-mid">
        Ya está en la cola con su folio. En tu panel ves quién lo toma y el
        resultado con su motivo.
      </p>
      <Button size="lg" className="mt-2 w-full" onClick={onDone}>
        Ver el seguimiento
      </Button>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  hint,
  error,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-hi">
        {label} {optional && <span className="text-low">(opcional)</span>}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className="w-full resize-y rounded-[var(--r-input)] border bg-surface px-3 py-2 text-[13px] leading-relaxed text-hi outline-none transition-colors placeholder:text-low focus:border-[var(--brand-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-ink)]"
        style={{ borderColor: error ? "var(--negative)" : "var(--border)" }}
      />
      {error ? (
        <span role="alert" className="text-[12px]" style={{ color: "var(--negative)" }}>
          {error}
        </span>
      ) : (
        hint && <span className="text-[12px] leading-snug text-low">{hint}</span>
      )}
    </label>
  );
}
