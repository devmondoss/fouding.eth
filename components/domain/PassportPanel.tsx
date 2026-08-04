import { BadgeCheck, Lock } from "lucide-react";
import { Row } from "@/components/ui/Stat";
import { formatDate, formatUsdc } from "@/lib/format";
import type { Company } from "@/lib/types";

/**
 * Pasaporte de negocio: soulbound (ERC-5192), nunca transferible. Convierte
 * el buen comportamiento en un activo portable de la empresa.
 */
export function PassportPanel({ company }: { company: Company }) {
  const p = company.passport;

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="h3">La empresa</h3>
          <p className="mt-1 text-[13px] text-mid">{company.name}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-[var(--r-pill)] border border-border bg-surface-soft px-2.5 py-1 text-[11.5px] text-low">
          <Lock className="h-3 w-3" />
          Perfil intransferible
        </span>
      </div>

      <div
        className="mt-3 flex items-center gap-2 rounded-[var(--r-panel)] border px-3 py-2 text-[12.5px]"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--positive)",
          color: "var(--positive)",
        }}
      >
        <BadgeCheck className="h-4 w-4" />
        <span className="font-medium">RUC {company.ruc} verificado</span>
        <span className="text-mid">· desde {formatDate(p.issuedAt)}</span>
      </div>

      <div className="mt-3">
        <Row label="Sector" value={company.sector} />
        <Row label="Ciudad" value={company.city} />
        <Row label="Años operando" value={company.yearsOperating} />
        <Row label="Colaboradores" value={company.employees} />
        <Row
          label="Ventas anuales verificadas"
          value={`${formatUsdc(p.verifiedRevenue)} USDC`}
          strong
        />
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <div className="label mb-2.5">Historial de pago en la plataforma</div>
        <div className="grid grid-cols-4 gap-2">
          <Mini label="Créditos" value={p.completedDeals} />
          <Mini
            label="A tiempo"
            value={p.onTimeRepayments}
            color="var(--positive)"
          />
          <Mini
            label="Tardíos"
            value={p.lateRepayments}
            color={p.lateRepayments > 0 ? "var(--warning)" : undefined}
          />
          <Mini
            label="Impagos"
            value={p.defaults}
            color={p.defaults > 0 ? "var(--negative)" : undefined}
          />
        </div>
      </div>
    </section>
  );
}

function Mini({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-[var(--r-panel)] border border-border bg-surface-soft px-2 py-2.5 text-center">
      <div
        className="num text-[18px] font-bold"
        style={{ color: color ?? "var(--text-hi)" }}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-low">{label}</div>
    </div>
  );
}
