"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { HAIRCUT_BY_KIND, type CollateralKind } from "@/lib/types";
import { usdc } from "@/lib/format";
import type { VerifierSubmission } from "@/lib/verifier/types";

/**
 * Underwriting: convierte un expediente aprobado en una oportunidad
 * publicable. Aprobar dice "la empresa es quien dice ser"; esto dice "y
 * estas son las condiciones" — plazo, tasa, colateral tasado e hitos.
 *
 * El valor neto recuperable NO se pide: lo deriva el servidor del valor
 * tasado y el haircut, porque es el único número que decide el crédito y
 * no puede depender de lo que mande el cliente (start.md §Cobertura).
 */

const KIND_LABEL: Record<CollateralKind, string> = {
  machinery: "Maquinaria",
  vehicle: "Vehículo",
  real_estate: "Inmueble",
};

type MilestoneDraft = { title: string; description: string; releaseBps: string };

/** Micro-USDC a partir de lo que se teclea en USDC. "50000" -> "50000000000". */
function toMicro(input: string): string | null {
  const n = Number(input.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return usdc(n).toString();
}

export function PublishOpportunityForm({
  submission,
  apiKey,
  verifierName,
  onClose,
  onPublished,
}: {
  submission: VerifierSubmission;
  apiKey: string;
  verifierName: string;
  onClose: () => void;
  onPublished: (slug: string) => void;
}) {
  const [sector, setSector] = useState("");
  const [city, setCity] = useState("");
  const [yearsOperating, setYearsOperating] = useState("");
  const [employees, setEmployees] = useState("");
  const [verifiedRevenue, setVerifiedRevenue] = useState("");

  const [summary, setSummary] = useState("");
  const [highlights, setHighlights] = useState("");
  // Prellenado con lo que pidió la empresa, en USDC — se convierte al enviar.
  const [targetAmount, setTargetAmount] = useState(submission.requestedAmount);
  const [borrowerContribution, setBorrowerContribution] = useState("20");
  const [termMonths, setTermMonths] = useState("12");
  const [apy, setApy] = useState("15");
  const [fundingDeadline, setFundingDeadline] = useState("");

  const [kind, setKind] = useState<CollateralKind>("machinery");
  const [description, setDescription] = useState("");
  const [appraisedValue, setAppraisedValue] = useState("");
  const [haircut, setHaircut] = useState(String(HAIRCUT_BY_KIND.machinery / 100));
  const [registryEntry, setRegistryEntry] = useState("");
  const [titleVerified, setTitleVerified] = useState(false);
  const [liens, setLiens] = useState("");

  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    { title: "Compra e importación", description: "", releaseBps: "50" },
    { title: "Instalación y puesta en marcha", description: "", releaseBps: "50" },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const releaseTotal = milestones.reduce(
    (acc, m) => acc + (Number(m.releaseBps) || 0),
    0,
  );
  const releaseOk = milestones.length === 0 || releaseTotal === 100;

  function changeKind(next: CollateralKind) {
    setKind(next);
    setHaircut(String(HAIRCUT_BY_KIND[next] / 100));
  }

  async function submit() {
    const target = toMicro(targetAmount);
    const appraised = toMicro(appraisedValue);

    if (!target) return setError("El monto objetivo debe ser mayor que cero");
    if (!appraised) return setError("El valor tasado del colateral es obligatorio");
    if (!fundingDeadline) return setError("Falta la fecha límite de fondeo");
    if (!releaseOk) {
      return setError(`Los hitos deben sumar 100%, suman ${releaseTotal}%`);
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/verifier/submissions/${submission.id}/publish`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            sector,
            city,
            yearsOperating: Number(yearsOperating) || 0,
            employees: Number(employees) || 0,
            verifiedRevenue: toMicro(verifiedRevenue) ?? "0",
            summary,
            highlights: highlights
              .split("\n")
              .map((h) => h.trim())
              .filter(Boolean),
            targetAmount: target,
            borrowerContributionBps: Math.round(
              (Number(borrowerContribution) || 0) * 100,
            ),
            termMonths: Number(termMonths) || 0,
            apyBps: Math.round((Number(apy) || 0) * 100),
            fundingDeadline,
            collateral: {
              kind,
              description,
              appraisedValue: appraised,
              haircutBps: Math.round((Number(haircut) || 0) * 100),
              registryEntry: registryEntry || null,
              titleVerified,
              liens: liens
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean),
            },
            milestones: milestones.map((m, i) => ({
              index: i,
              title: m.title,
              description: m.description,
              releaseBps: Math.round((Number(m.releaseBps) || 0) * 100),
              status: "pending",
            })),
            decidedBy: verifierName,
          }),
        },
      );

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudo publicar la oportunidad");
        return;
      }
      onPublished(body.slug as string);
    } catch {
      setError("No se pudo publicar la oportunidad");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Publicar oportunidad"
      subtitle={`${submission.projectTitle} — ${submission.companyName}`}
      width={620}
      footer={
        <div className="flex w-full items-center gap-2.5">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={submit}
            loading={submitting}
            disabled={submitting}
          >
            Publicar al catálogo
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {error && (
          <div
            className="rounded-[var(--r-panel)] border px-3 py-2.5 text-[12.5px]"
            style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
          >
            {error}
          </div>
        )}

        <Section title="La empresa">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sector" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Manufactura" />
            <Field label="Ciudad" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Arequipa" />
            <Field label="Años operando" inputMode="numeric" value={yearsOperating} onChange={(e) => setYearsOperating(e.target.value)} placeholder="8" />
            <Field label="Colaboradores" inputMode="numeric" value={employees} onChange={(e) => setEmployees(e.target.value)} placeholder="24" />
          </div>
          <Field
            label="Ventas anuales verificadas"
            suffix="USDC"
            inputMode="decimal"
            value={verifiedRevenue}
            onChange={(e) => setVerifiedRevenue(e.target.value)}
            hint="Lo que respalda el expediente"
          />
        </Section>

        <Section title="Condiciones del crédito">
          <Field
            label="Resumen del proyecto"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Para qué es el capital, en una línea"
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-hi">
              Hechos verificables <span className="text-low">(uno por línea)</span>
            </span>
            <textarea
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
              rows={3}
              className="rounded-[var(--r-input)] border border-border bg-surface px-3 py-2 text-[13px] text-hi outline-none focus:border-[var(--brand-ink)]"
              placeholder={"Contrato firmado con dos clientes\nMaquinaria ya cotizada"}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto objetivo" suffix="USDC" inputMode="decimal" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} />
            <Field label="Aporte propio" suffix="%" inputMode="decimal" value={borrowerContribution} onChange={(e) => setBorrowerContribution(e.target.value)} />
            <Field label="Plazo" suffix="meses" inputMode="numeric" value={termMonths} onChange={(e) => setTermMonths(e.target.value)} />
            <Field label="Rentabilidad" suffix="%" inputMode="decimal" value={apy} onChange={(e) => setApy(e.target.value)} />
          </div>
          <Field label="Cierre de fondeo" type="date" value={fundingDeadline} onChange={(e) => setFundingDeadline(e.target.value)} />
        </Section>

        <Section title="Garantía">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-hi">Tipo de activo</span>
            <div className="flex gap-2">
              {(Object.keys(KIND_LABEL) as CollateralKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => changeKind(k)}
                  className="flex-1 rounded-[var(--r-input)] border px-3 py-2 text-[12.5px] font-medium transition-colors"
                  style={{
                    borderColor: kind === k ? "var(--brand-ink)" : "var(--border)",
                    color: kind === k ? "var(--brand-ink)" : "var(--text-mid)",
                  }}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </label>
          <Field label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Dos secadoras industriales, modelo…" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor tasado" suffix="USDC" inputMode="decimal" value={appraisedValue} onChange={(e) => setAppraisedValue(e.target.value)} />
            <Field
              label="Castigo (haircut)"
              suffix="%"
              inputMode="decimal"
              value={haircut}
              onChange={(e) => setHaircut(e.target.value)}
            />
          </div>
          <Field label="Partida registral (SUNARP)" value={registryEntry} onChange={(e) => setRegistryEntry(e.target.value)} placeholder="Partida 04129877 — SUNARP Arequipa" />
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-hi">
              Gravámenes previos <span className="text-low">(uno por línea, vacío si no hay)</span>
            </span>
            <textarea
              value={liens}
              onChange={(e) => setLiens(e.target.value)}
              rows={2}
              className="rounded-[var(--r-input)] border border-border bg-surface px-3 py-2 text-[13px] text-hi outline-none focus:border-[var(--brand-ink)]"
            />
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-hi">
            <input
              type="checkbox"
              checked={titleVerified}
              onChange={(e) => setTitleVerified(e.target.checked)}
            />
            Titularidad verificada contra el registro
          </label>
        </Section>

        <Section title="Cronograma de desembolsos">
          <p className="text-[12px] text-low">Los tramos deben sumar 100%.</p>
          {milestones.map((m, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Field
                  label={`Hito ${i + 1}`}
                  value={m.title}
                  onChange={(e) =>
                    setMilestones((ms) =>
                      ms.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                    )
                  }
                />
              </div>
              <div className="w-[100px]">
                <Field
                  label="Libera"
                  suffix="%"
                  inputMode="decimal"
                  value={m.releaseBps}
                  onChange={(e) =>
                    setMilestones((ms) =>
                      ms.map((x, j) =>
                        j === i ? { ...x, releaseBps: e.target.value } : x,
                      ),
                    )
                  }
                />
              </div>
              {/* El tacho de basura era el único control de esta pantalla
                  que no decía qué hacía. "Quitar" ocupa lo mismo. */}
              <button
                type="button"
                onClick={() => setMilestones((ms) => ms.filter((_, j) => j !== i))}
                className="focusable mb-[1px] flex h-10 shrink-0 items-center rounded-[var(--r-input)] border border-border px-3 text-[12.5px] text-mid transition-colors hover:bg-surface-soft hover:text-hi"
                aria-label={`Quitar hito ${i + 1}`}
              >
                Quitar
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setMilestones((ms) => [
                  ...ms,
                  { title: "", description: "", releaseBps: "0" },
                ])
              }
            >
              Agregar hito
            </Button>
            <span
              className="num text-[12.5px] font-medium"
              style={{ color: releaseOk ? "var(--positive)" : "var(--negative)" }}
            >
              {releaseTotal}%
            </span>
          </div>
        </Section>
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="label border-b border-border pb-2">{title}</h3>
      {children}
    </section>
  );
}
