"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  CircleAlert,
  ExternalLink,
  FileCheck2,
  History,
  Loader2,
  Lock,
  Network,
} from "lucide-react";
import { useCompanyEvidence } from "@/hooks/useCompanyEvidence";
import {
  useCompanyPassport,
  type CompanyPassportStatus,
} from "@/hooks/useCompanyPassport";
import { protocolChain } from "@/lib/web3/config";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Row } from "@/components/ui/Stat";
import { formatDate, shortHash } from "@/lib/format";
import type { Company } from "@/lib/types";

const STATUS_VIEW: Record<
  CompanyPassportStatus,
  { label: string; tone: "neutral" | "positive" | "warning" | "negative" }
> = {
  loading: { label: "Consultando blockchain…", tone: "neutral" },
  "wrong-network": { label: "Red incorrecta", tone: "warning" },
  "no-passport": {
    label: "Empresa todavía no tiene Company Passport",
    tone: "neutral",
  },
  active: { label: "Empresa verificada on-chain", tone: "positive" },
  suspended: { label: "Pasaporte suspendido", tone: "warning" },
  revoked: { label: "Pasaporte revocado", tone: "negative" },
  expired: { label: "Pasaporte expirado", tone: "negative" },
  "rpc-error": { label: "Datos on-chain no disponibles", tone: "negative" },
};

const INTERNAL_STATUS = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
} as const;

type HashCheck = "idle" | "match" | "mismatch" | "unavailable";

/**
 * Company Passport: presenta por separado blockchain, evidencia privada
 * resumida por Neon e historial indexado de Fouding. Ningún error de RPC se
 * convierte en un estado verificado y ningún dato mock representa la cadena.
 */
export function PassportPanel({ company }: { company: Company }) {
  const passport = useCompanyPassport(company.walletAddress);
  const evidence = useCompanyEvidence(company.walletAddress);
  const [hashCheck, setHashCheck] = useState<HashCheck>("idle");
  const statusView = STATUS_VIEW[passport.status];
  const explorer = protocolChain.blockExplorers?.default.url?.replace(
    /\/$/,
    "",
  );

  useEffect(() => {
    setHashCheck("idle");
  }, [
    company.walletAddress,
    evidence.evidence?.legalPackHash,
    passport.credential?.legalPackHash,
  ]);

  function checkHash() {
    const expected = evidence.evidence?.legalPackHash;
    const onchain = passport.credential?.legalPackHash;
    if (!expected || !onchain) {
      setHashCheck("unavailable");
      return;
    }
    setHashCheck(
      expected.toLowerCase() === onchain.toLowerCase() ? "match" : "mismatch",
    );
  }

  return (
    <section className="card p-4 sm:p-5">
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

      <SourceSection
        icon={<Network className="h-4 w-4" />}
        title="Estado on-chain"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Pill label={statusView.label} tone={statusView.tone} dot />
          {passport.status === "loading" && (
            <Loader2 className="h-4 w-4 animate-spin text-low" />
          )}
        </div>

        {passport.status === "wrong-network" && (
          <Message>
            Conecta la wallet a {protocolChain.name} ({passport.chainId}) para
            consultar el pasaporte.
          </Message>
        )}
        {passport.status === "rpc-error" && (
          <Message>
            No se pudo consultar el contrato. Revisa el RPC y el deployment de
            la red configurada.
          </Message>
        )}

        {passport.credential && passport.tokenId !== null && (
          <div className="mt-3">
            <Row label="Token ID" value={`#${passport.tokenId.toString()}`} />
            <Row
              label="Emitido"
              value={formatTimestamp(passport.credential.issuedAt)}
            />
            <Row
              label="Vence"
              value={formatTimestamp(passport.credential.expiresAt)}
            />
            <Row label="Chain ID" value={passport.chainId} />
            <Row
              label="Contrato"
              value={
                passport.contractAddress
                  ? shortHash(passport.contractAddress, 5)
                  : "No configurado"
              }
            />
          </div>
        )}

        {explorer && passport.contractAddress && (
          <div className="mt-3 flex flex-wrap gap-2">
            <ExplorerLink
              href={`${explorer}/address/${passport.contractAddress}`}
            >
              Ver contrato
            </ExplorerLink>
            {passport.issuanceTxHash && (
              <ExplorerLink href={`${explorer}/tx/${passport.issuanceTxHash}`}>
                Ver emisión
              </ExplorerLink>
            )}
          </div>
        )}
      </SourceSection>

      <SourceSection
        icon={<FileCheck2 className="h-4 w-4" />}
        title="Evidencia off-chain"
      >
        {evidence.isLoading && (
          <Message>Consultando evidencia verificada…</Message>
        )}
        {evidence.error && (
          <Message>No se pudo consultar la evidencia en este momento.</Message>
        )}
        {!evidence.isLoading && !evidence.error && !evidence.evidence && (
          <Message>
            No hay evidencia pública disponible para esta empresa.
          </Message>
        )}

        {evidence.evidence && (
          <>
            <div>
              <Row label="Razón social" value={evidence.evidence.companyName} />
              <Row label="RUC" value={evidence.evidence.companyRuc || "—"} />
              <Row
                label="Estado interno"
                value={INTERNAL_STATUS[evidence.evidence.verificationStatus]}
              />
              <Row
                label="Verificador"
                value={evidence.evidence.verifier || "No asignado"}
              />
              <Row
                label="Última revisión"
                value={
                  evidence.evidence.lastReviewedAt
                    ? formatDate(evidence.evidence.lastReviewedAt)
                    : "Pendiente"
                }
              />
              <Row
                label="Legal pack"
                value={shortHash(evidence.evidence.legalPackHash, 6)}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={checkHash}>
                Comprobar hash
              </Button>
              <HashResult result={hashCheck} />
            </div>
          </>
        )}
      </SourceSection>

      <SourceSection
        icon={<History className="h-4 w-4" />}
        title="Historial Fouding"
      >
        {company.foudingHistory ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Mini
                label="Créditos"
                value={company.foudingHistory.completedCredits}
              />
              <Mini
                label="A tiempo"
                value={company.foudingHistory.onTimePayments}
                color="var(--positive)"
              />
              <Mini
                label="Tardíos"
                value={company.foudingHistory.latePayments}
                color={
                  company.foudingHistory.latePayments > 0
                    ? "var(--warning)"
                    : undefined
                }
              />
              <Mini
                label="Impagos"
                value={company.foudingHistory.defaults}
                color={
                  company.foudingHistory.defaults > 0
                    ? "var(--negative)"
                    : undefined
                }
              />
            </div>
            {explorer && company.foudingHistory.transactions.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {company.foudingHistory.transactions.map((transaction) => (
                  <a
                    key={transaction.txHash}
                    href={`${explorer}/tx/${transaction.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-[var(--r-panel)] border border-border px-3 py-2 text-[12.5px] text-mid transition-colors hover:border-border-strong hover:text-hi"
                  >
                    {transaction.label}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            )}
          </>
        ) : (
          <Message>
            El historial todavía no está indexado para esta empresa. No se
            muestran cifras de demostración como actividad real.
          </Message>
        )}
      </SourceSection>
    </section>
  );
}

function SourceSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 border-t border-border pt-4 first:border-t-0">
      <div className="mb-3 flex items-center gap-2 text-[12.5px] font-semibold text-hi">
        <span className="text-mid">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function Message({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 rounded-[var(--r-panel)] border border-border bg-surface-soft px-3 py-2 text-[12.5px] leading-relaxed text-mid">
      {children}
    </p>
  );
}

function ExplorerLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-8 items-center gap-1.5 rounded-[var(--r-input)] border border-border bg-surface px-3 text-[12.5px] font-medium text-hi transition-colors hover:border-border-strong hover:bg-surface-soft"
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function HashResult({ result }: { result: HashCheck }) {
  if (result === "idle") return null;
  const view = {
    match: {
      icon: <BadgeCheck className="h-4 w-4" />,
      label: "Coincide con blockchain",
      color: "var(--positive)",
    },
    mismatch: {
      icon: <CircleAlert className="h-4 w-4" />,
      label: "No coincide",
      color: "var(--negative)",
    },
    unavailable: {
      icon: <CircleAlert className="h-4 w-4" />,
      label: "Comparación no disponible",
      color: "var(--text-mid)",
    },
  }[result];

  return (
    <span
      className="flex items-center gap-1 text-[12px] font-medium"
      style={{ color: view.color }}
    >
      {view.icon}
      {view.label}
    </span>
  );
}

function formatTimestamp(timestamp: bigint): string {
  return formatDate(new Date(Number(timestamp) * 1_000).toISOString());
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
