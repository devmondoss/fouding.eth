"use client";

import { useEffect, useState, type ReactNode } from "react";
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
        <span className="shrink-0 rounded-[var(--r-pill)] border border-border bg-surface-soft px-2.5 py-1 text-[11.5px] text-low">
          Perfil intransferible
        </span>
      </div>

      <SourceSection title="Estado on-chain">
        {/* El spinner al lado de la píldora era redundante: la píldora dice
            literalmente "Consultando blockchain…". */}
        <Pill label={statusView.label} tone={statusView.tone} dot />

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

      <SourceSection title="Evidencia off-chain">
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

      <SourceSection title="Historial Fouding">
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
                    className="focusable flex items-center justify-between rounded-[var(--r-panel)] border border-border px-3 py-2 text-[12.5px] text-mid transition-colors hover:border-border-strong hover:text-hi"
                  >
                    {transaction.label}
                    <span className="text-[11.5px] text-low">
                      Ver en el explorador
                    </span>
                  </a>
                ))}
              </div>
            )}
          </>
        ) : (
          <Message>
            El historial de esta empresa todavía no está indexado.
          </Message>
        )}
      </SourceSection>
    </section>
  );
}

/**
 * Cada sección llevaba un ícono —red, documento, reloj— delante del título.
 * Tres glifos de librería para tres títulos que ya nombran su fuente:
 * "Estado on-chain", "Evidencia off-chain", "Historial Fouding". El título
 * es la etiqueta; el ícono era decoración.
 */
function SourceSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 border-t border-border pt-4 first:border-t-0">
      <div className="mb-3 text-[12.5px] font-semibold text-hi">{title}</div>
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
      className="focusable inline-flex h-8 items-center rounded-[var(--r-input)] border border-border bg-surface px-3 text-[12.5px] font-medium text-hi transition-colors hover:border-border-strong hover:bg-surface-soft"
    >
      {children}
    </a>
  );
}

function HashResult({ result }: { result: HashCheck }) {
  if (result === "idle") return null;
  // El resultado ya está escrito: "Coincide con blockchain" no necesita un
  // sello al lado, y los dos casos negativos usaban el mismo glifo, así que
  // lo único que los distinguía era la palabra.
  const view = {
    match: { label: "Coincide con blockchain", color: "var(--positive)" },
    mismatch: { label: "No coincide", color: "var(--negative)" },
    unavailable: {
      label: "Comparación no disponible",
      color: "var(--text-mid)",
    },
  }[result];

  return (
    <span className="text-[12px] font-medium" style={{ color: view.color }}>
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
