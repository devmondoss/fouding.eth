"use client";

import type { ReactNode } from "react";
import { formatDate, shortHash } from "@/lib/format";
import {
  COLLATERAL_LABEL,
  PROJECT_TYPE_LABEL,
  declaredCoverage,
  folio,
  formatUsdcPlain,
} from "@/lib/verifier/submission";
import type { CollateralKind } from "@/lib/types";

/**
 * El expediente como documento, no como resumen.
 *
 * Antes el último paso del asistente mostraba tres líneas sueltas
 * (nombre, título, monto) y eso era todo lo que la empresa llegaba a ver
 * de lo que estaba firmando. Esto se lee como el comprobante de una
 * operación: cabecera con folio y fecha, secciones con su dato al lado
 * del rótulo, el monto pedido como total, y al pie lo que la plataforma
 * NO está prometiendo todavía.
 *
 * Lo usan dos superficies con el mismo shape: el paso de revisión del
 * asistente (con un borrador que aún no existe en base) y el detalle del
 * expediente ya enviado. Por eso recibe un modelo plano y no una
 * VerifierSubmission — el borrador no tiene id ni fecha.
 */

export type ReceiptModel = {
  id?: string | null;
  submittedAt?: string | null;

  companyName: string;
  companyRuc: string;
  companyWallet: string;
  sector: string;
  city: string;
  yearsOperating: string | number;
  annualRevenue: string;

  projectTitle: string;
  projectType: string;
  useOfFunds: string;
  requestedAmount: string;
  termMonths: string | number;

  collateralKind: string;
  collateralValue: string;
  collateralDetail: string;

  legalPackName?: string | null;
  legalPackHash?: string | null;
};

export function SubmissionReceipt({
  model,
  dense = false,
}: {
  model: ReceiptModel;
  dense?: boolean;
}) {
  const coverage = declaredCoverage(model.collateralValue, model.requestedAmount);
  const term = Number(model.termMonths) || 0;

  return (
    <div className="overflow-hidden rounded-[var(--r-panel)] border border-border bg-surface">
      <header
        className="flex items-baseline justify-between gap-3 border-b px-4 py-3"
        style={{
          backgroundColor: "var(--surface-soft)",
          borderColor: "var(--border)",
        }}
      >
        <div>
          <div className="label">Expediente de financiamiento</div>
          <div className="num mt-0.5 text-[13px] font-semibold text-hi">
            {model.id ? folio(model.id) : "Sin folio hasta enviar"}
          </div>
        </div>
        <div className="text-right">
          <div className="label">Fecha</div>
          <div className="num mt-0.5 text-[12.5px] text-mid">
            {model.submittedAt ? formatDate(model.submittedAt) : "—"}
          </div>
        </div>
      </header>

      <div className={dense ? "px-4 py-3" : "px-4 py-4"}>
        <Block title="Solicitante">
          <Row label="Razón social" value={model.companyName || "—"} />
          <Row label="RUC" value={model.companyRuc || "—"} mono />
          <Row
            label="Actividad"
            value={[model.sector, model.city].filter(Boolean).join(" · ") || "—"}
          />
          <Row
            label="Años operando"
            value={
              Number(model.yearsOperating) > 0
                ? `${Number(model.yearsOperating)} años`
                : "—"
            }
          />
          <Row
            label="Ventas último año"
            value={
              model.annualRevenue
                ? `${formatUsdcPlain(model.annualRevenue)} USDC`
                : "No declaradas"
            }
            hint="Declarado"
          />
          <Row label="Wallet" value={model.companyWallet} mono truncate />
        </Block>

        <Block title="Operación solicitada">
          <Row label="Proyecto" value={model.projectTitle || "—"} />
          <Row label="Tipo" value={PROJECT_TYPE_LABEL[model.projectType] ?? "—"} />
          <Row
            label="Plazo pedido"
            value={term > 0 ? `${term} meses` : "—"}
            hint="Referencial: el plazo definitivo lo fija el verificador"
          />
          {model.useOfFunds && (
            <div className="border-t border-border py-2">
              <div className="text-[11.5px] text-low">Destino del capital</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-mid">
                {model.useOfFunds}
              </p>
            </div>
          )}
        </Block>

        <Block title="Garantía ofrecida">
          <Row
            label="Activo"
            value={COLLATERAL_LABEL[model.collateralKind as CollateralKind] ?? "—"}
          />
          <Row
            label="Valor declarado"
            value={
              model.collateralValue
                ? `${formatUsdcPlain(model.collateralValue)} USDC`
                : "—"
            }
          />
          <Row
            label="Cobertura declarada"
            value={coverage ? `${coverage.toFixed(2)}x` : "—"}
            hint="Sobre valor declarado. La cobertura real sale de la tasación menos el castigo por tipo de activo"
          />
          {model.collateralDetail && (
            <div className="border-t border-border py-2">
              <div className="text-[11.5px] text-low">Descripción del activo</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-mid">
                {model.collateralDetail}
              </p>
            </div>
          )}
        </Block>

        <Block title="Documentación">
          <Row
            label="Expediente legal"
            value={model.legalPackName || "No adjuntado"}
            truncate
          />
          <Row
            label="Huella del documento"
            value={model.legalPackHash ? shortHash(model.legalPackHash, 8) : "—"}
            mono
            hint="El archivo queda en storage privado; a la cadena solo va este hash"
          />
        </Block>

        {/* El total: es la cifra por la que se lee el documento entero. */}
        <div
          className="mt-3 flex items-end justify-between gap-3 rounded-[var(--r-panel)] px-3 py-3"
          style={{ backgroundColor: "var(--surface-soft)" }}
        >
          <div>
            <div className="label">Monto solicitado</div>
            <div className="mt-0.5 text-[11.5px] text-low">
              En USDC, desembolsado por hitos contra escrow
            </div>
          </div>
          <div className="num text-right text-[22px] font-semibold leading-none text-hi">
            {model.requestedAmount ? formatUsdcPlain(model.requestedAmount) : "—"}
            <span className="ml-1 text-[12px] font-medium text-mid">USDC</span>
          </div>
        </div>

        <p className="mt-3 text-[11.5px] leading-relaxed text-low">
          Este documento registra lo que la empresa declara. No es una
          aprobación ni una oferta de crédito: la rentabilidad, el plazo
          definitivo y el cronograma de desembolsos los fija el verificador
          después de tasar la garantía, y la operación solo existe para
          inversionistas cuando se publica en el catálogo.
        </p>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-3 last:mb-0">
      <h4 className="label border-b border-border pb-1.5">{title}</h4>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  hint,
  mono = false,
  truncate = false,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-1.5 last:border-b-0">
      <div className="min-w-0">
        <span className="text-[12px] text-mid">{label}</span>
        {hint && (
          <span className="mt-0.5 block max-w-[300px] text-[11px] leading-snug text-low">
            {hint}
          </span>
        )}
      </div>
      <span
        className={[
          "shrink-0 text-right text-[12.5px] font-medium text-hi",
          mono ? "num" : "",
          truncate ? "max-w-[240px] truncate" : "",
        ].join(" ")}
        title={truncate ? value : undefined}
      >
        {value}
      </span>
    </div>
  );
}
