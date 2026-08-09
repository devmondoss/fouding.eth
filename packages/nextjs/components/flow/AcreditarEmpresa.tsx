"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ChoiceGroup } from "@/components/ui/Choice";
import { useSession } from "@/lib/useSession";
import { fadeUp, stagger } from "@/lib/motion";
import {
  MIN_YEARS_OPERATING,
  REVIEW_SLA_DAYS,
  SECTORS,
  digits,
  parseAmount,
  rucError,
  yearsError,
} from "@/lib/verifier/submission";
import type { Company } from "@/lib/verifier/companies";

/**
 * Acreditar la empresa: el trámite que hay que pasar UNA VEZ antes de
 * poder pedir financiamiento.
 *
 * Antes esto no existía como paso propio. Los datos de la empresa —RUC,
 * sector, años de operación— viajaban dentro de cada solicitud, así que
 * la primera vez había que llenar un formulario de cuatro pasos para que
 * recién ahí alguien mirara si la empresa era financiable, y en cada
 * proyecto nuevo se volvían a pedir los mismos datos.
 *
 * Son seis campos porque es lo que se necesita para decidir si una
 * empresa califica. El proyecto —monto, plazo, garantía— viene después,
 * cuando ya sabemos con quién estamos hablando.
 */
export function AcreditarEmpresa({
  address,
  empresa,
  onCancel,
  onDone,
}: {
  address: string;
  /** Si viene, es un reenvío tras un rechazo: se corrige lo observado. */
  empresa: Company | null;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { getAccessToken } = useSession();

  const [name, setName] = useState(empresa?.name ?? "");
  const [ruc, setRuc] = useState(empresa?.ruc ?? "");
  const [sector, setSector] = useState<string | null>(empresa?.sector || null);
  const [city, setCity] = useState(empresa?.city ?? "");
  const [years, setYears] = useState(
    empresa?.yearsOperating ? String(empresa.yearsOperating) : "",
  );
  const [employees, setEmployees] = useState(
    empresa?.employees ? String(empresa.employees) : "",
  );
  const [revenue, setRevenue] = useState(empresa?.annualRevenue ?? "");
  const [file, setFile] = useState<File | null>(null);

  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = useMemo(
    () => ({
      name: name.trim() ? null : "La razón social de tu empresa",
      ruc: rucError(ruc),
      sector: sector ? null : "Elige el sector",
      city: city.trim() ? null : "En qué ciudad opera",
      years: yearsError(years),
    }),
    [name, ruc, sector, city, years],
  );
  const valido = Object.values(errors).every((e) => e === null);
  const show = (m: string | null) => (attempted ? m : null);

  async function enviar() {
    setAttempted(true);
    if (!valido || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Tu sesión expiró, vuelve a entrar");
      const auth = { Authorization: `Bearer ${token}` };

      let legalPackHash = "";
      if (file) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/verifier/documents", {
          method: "POST",
          headers: auth,
          body: form,
        });
        if (!res.ok) {
          const b = await res.json().catch(() => null);
          throw new Error(b?.error ?? "No se pudo subir el documento");
        }
        legalPackHash = (await res.json()).hash;
      }

      const res = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({
          name: name.trim(),
          ruc: digits(ruc),
          sector,
          city: city.trim(),
          yearsOperating: Number(digits(years)) || 0,
          employees: Number(digits(employees)) || 0,
          annualRevenue: revenue ? String(parseAmount(revenue)) : "",
          legalPackHash,
          legalPackName: file?.name ?? "",
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error ?? "No se pudo enviar tu empresa");
      }
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Algo falló, intenta de nuevo");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "var(--bg)" }}>
      <header
        className="sticky top-0 z-10 border-b border-border"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <div className="mx-auto flex w-full max-w-[var(--w-doc)] items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
          <div className="min-w-0">
            <h1 className="h2 text-[16px]">
              {empresa?.status === "rejected" ? "Corregir tu empresa" : "Acredita tu empresa"}
            </h1>
            <p className="mt-0.5 text-[12px] text-low">
              Se hace una sola vez · respuesta en {REVIEW_SLA_DAYS} días hábiles
            </p>
          </div>
          {!submitting && (
            <button
              onClick={onCancel}
              className="focusable -mr-1 flex h-8 shrink-0 items-center rounded-[var(--r-input)] px-2 text-[12.5px] text-mid transition-colors hover:bg-surface-soft hover:text-hi"
            >
              Descartar
            </button>
          )}
        </div>
      </header>

      <motion.main
        variants={stagger(0.05)}
        initial="hidden"
        animate="show"
        className="mx-auto w-full max-w-[var(--w-doc)] flex-1 px-5 py-6 sm:px-6 sm:py-8"
      >
        {empresa?.status === "rejected" && empresa.note && (
          <motion.div
            variants={fadeUp}
            className="mb-5 rounded-[var(--r-panel)] border p-4"
            style={{ borderColor: "var(--negative)" }}
          >
            <div
              className="text-[12.5px] font-semibold"
              style={{ color: "var(--negative)" }}
            >
              Lo que observó el verificador
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-mid">
              {empresa.note}
            </p>
          </motion.div>
        )}

        <motion.div variants={fadeUp} className="flex flex-col gap-4">
          <Field
            label="Razón social"
            placeholder="Textiles del Sur S.A.C."
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={show(errors.name)}
            autoFocus
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="RUC"
              placeholder="20123456789"
              inputMode="numeric"
              maxLength={11}
              value={ruc}
              onChange={(e) => setRuc(digits(e.target.value))}
              error={show(errors.ruc)}
              hint="11 dígitos"
            />
            <Field
              label="Ciudad"
              placeholder="Arequipa"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              error={show(errors.city)}
            />
          </div>

          <ChoiceGroup
            label="Sector"
            columns={2}
            options={SECTORS.map((s) => ({ value: s, label: s }))}
            value={sector}
            onChange={setSector}
            error={show(errors.sector)}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field
              label="Años operando"
              placeholder="8"
              inputMode="numeric"
              value={years}
              onChange={(e) => setYears(digits(e.target.value))}
              error={show(errors.years)}
              hint={`Mínimo ${MIN_YEARS_OPERATING}`}
            />
            <Field
              label="Colaboradores"
              placeholder="24"
              inputMode="numeric"
              value={employees}
              onChange={(e) => setEmployees(digits(e.target.value))}
              hint="Opcional"
            />
            <Field
              label="Ventas del último año"
              suffix="USDC"
              inputMode="decimal"
              placeholder="480000"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
              hint="Opcional"
            />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-hi">
              Documentación de la empresa <span className="text-low">(opcional)</span>
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
              Ficha RUC, vigencia de poderes o comprobantes de venta. Se guarda en
              storage privado — a la cadena solo llega su hash.
            </span>
          </label>

          <Field
            label="Wallet de la empresa"
            value={address}
            hint="Es la que recibe el pasaporte de negocio si se acredita. No se puede cambiar."
            readOnly
            disabled
          />

          {error && (
            <div
              role="alert"
              className="rounded-[var(--r-panel)] border px-3 py-2.5 text-[12.5px]"
              style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
            >
              {error}
            </div>
          )}
        </motion.div>
      </motion.main>

      <div
        className="sticky bottom-0 border-t border-border"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <div className="mx-auto flex w-full max-w-[var(--w-doc)] items-center gap-3 px-5 py-3.5 sm:px-6">
          <Button
            size="lg"
            className="flex-1"
            onClick={enviar}
            loading={submitting}
            disabled={submitting}
          >
            Enviar a acreditación
          </Button>
          <p className="hidden text-[11.5px] leading-snug text-low sm:block">
            Después de esto ya puedes pedir financiamiento
            <br />
            para tus proyectos.
          </p>
        </div>
      </div>
    </div>
  );
}
