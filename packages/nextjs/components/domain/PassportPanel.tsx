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
import { Bloque, Cifra, Encabezado } from "./FichaTab";
import { formatDate, shortHash } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/verifier/submission";
import type { Company } from "@/lib/types";

const STATUS_VIEW: Record<
  CompanyPassportStatus,
  { label: string; tone: "neutral" | "positive" | "warning" | "negative" }
> = {
  loading: { label: "Consultando blockchain…", tone: "neutral" },
  "wrong-network": { label: "Red incorrecta", tone: "warning" },
  "no-passport": { label: "Sin pasaporte emitido", tone: "neutral" },
  active: { label: "Verificada on-chain", tone: "positive" },
  suspended: { label: "Pasaporte suspendido", tone: "warning" },
  revoked: { label: "Pasaporte revocado", tone: "negative" },
  expired: { label: "Pasaporte expirado", tone: "negative" },
  "rpc-error": { label: "Datos on-chain no disponibles", tone: "negative" },
};

/* Los rótulos de estado del expediente son los mismos que ven la empresa
   y el verificador (lib/verifier/submission.ts): tres copias del mismo
   diccionario ya habían empezado a divergir. */
const INTERNAL_STATUS = STATUS_LABEL;

type HashCheck = "idle" | "match" | "mismatch" | "unavailable";

/**
 * La empresa detrás de la operación.
 *
 * Estaba ordenada por FUENTE —on-chain, off-chain, historial—, que es
 * cómo la construimos nosotros y no cómo la lee un inversionista. Lo
 * primero de la pestaña eran Token ID, Chain ID y dirección de contrato:
 * seis filas de plomería antes de decir si la empresa había pagado sus
 * créditos anteriores. Y el pasaporte es soulbound justamente para que
 * ese historial no se pueda tirar a la basura abriendo otra wallet.
 *
 * Ahora manda el sujeto: quién es, cómo pagó, y recién al final la prueba
 * en cadena de que eso no es una declaración nuestra. La prueba no se
 * esconde —es el argumento del producto— pero deja de ir primero.
 */
export function PassportPanel({ company }: { company: Company }) {
  const passport = useCompanyPassport(company.walletAddress);
  const evidence = useCompanyEvidence(company.walletAddress);
  const [hashCheck, setHashCheck] = useState<HashCheck>("idle");
  const statusView = STATUS_VIEW[passport.status];
  const explorer = protocolChain.blockExplorers?.default.url?.replace(/\/$/, "");
  const h = company.foudingHistory;

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

  // El historial sale del PASAPORTE, que siempre viene con la operación,
  // y no de `foudingHistory`, que es opcional y solo trae los enlaces al
  // explorador. Leerlo de ahí dejaba esta pestaña con tres guiones
  // mientras el resumen —que sí usa el pasaporte— decía "4 créditos
  // previos, 24/25 a tiempo" de la misma empresa.
  const p = company.passport;
  const total = p.onTimeRepayments + p.lateRepayments + p.defaults;

  return (
    <div>
      <Encabezado>
        <Cifra
          label="Créditos en Árbitro"
          value={p.completedDeals}
          nota={
            p.completedDeals === 0
              ? "primera vez en la plataforma"
              : "ya completados"
          }
        />
        {total > 0 && (
          <Cifra
            label="Pagos a tiempo"
            value={`${p.onTimeRepayments}/${total}`}
            nota={
              p.defaults > 0
                ? `${p.defaults} en impago`
                : p.lateRepayments > 0
                  ? `${p.lateRepayments} tardío${p.lateRepayments === 1 ? "" : "s"}`
                  : "sin incidencias"
            }
            color={
              p.defaults > 0
                ? "var(--negative)"
                : p.lateRepayments > 0
                  ? "var(--warning)"
                  : "var(--positive)"
            }
          />
        )}
        <div className="min-w-0">
          <div className="label">Pasaporte</div>
          <div className="mt-1">
            <Pill label={statusView.label} tone={statusView.tone} dot />
          </div>
          <div className="mt-1 text-[11px] text-low">
            Intransferible: el historial no se deja atrás
          </div>
        </div>
      </Encabezado>

      {/* Lo que sabemos de la empresa sale del expediente que viene con la
          operación; la consulta a Neon solo AGREGA quién la revisó y
          cuándo. Antes todo el bloque dependía de esa consulta, así que
          sin ella la pestaña no decía ni el RUC —dato que ya estaba en
          memoria. */}
      <Bloque titulo="La empresa">
        <Row label="Razón social" value={company.name} />
        <Row label="RUC" value={company.ruc || "—"} />
        <Row
          label="Actividad"
          value={`${company.sector} · ${company.city}`}
        />
        <Row
          label="Trayectoria"
          value={`${company.yearsOperating} años · ${company.employees} colaboradores`}
        />
        {evidence.evidence && (
          <Row
            label="Revisión"
            value={
              evidence.evidence.lastReviewedAt
                ? `${INTERNAL_STATUS[evidence.evidence.verificationStatus]} el ${formatDate(evidence.evidence.lastReviewedAt)}${evidence.evidence.verifier ? ` por ${evidence.evidence.verifier}` : ""}`
                : "Pendiente"
            }
          />
        )}
        {evidence.error && (
          <p className="mt-2 text-[11.5px] text-low">
            No se pudo consultar quién revisó el expediente en este momento.
          </p>
        )}
      </Bloque>

      {h && h.transactions.length > 0 && explorer && (
        <Bloque titulo="Movimientos en cadena">
          <div className="flex flex-col">
            {h.transactions.map((t) => (
              <a
                key={t.txHash}
                href={`${explorer}/tx/${t.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="focusable flex items-center justify-between gap-3 border-b border-border py-2 text-[12.5px] text-mid transition-colors last:border-b-0 hover:text-hi"
              >
                <span className="min-w-0 truncate">{t.label}</span>
                <span className="num shrink-0 text-[11.5px] text-low">
                  {shortHash(t.txHash, 5)}
                </span>
              </a>
            ))}
          </div>
        </Bloque>
      )}

      {/* La prueba, al final: es lo que sostiene todo lo de arriba, no lo
          que hay que leer primero. */}
      <Bloque
        titulo="La prueba"
        aparte={
          <span className="text-[11px] text-low">
            {protocolChain.name} · {passport.chainId}
          </span>
        }
      >
        {passport.status === "wrong-network" && (
          <Aviso>
            Conecta la wallet a {protocolChain.name} para consultar el
            pasaporte.
          </Aviso>
        )}
        {passport.status === "rpc-error" && (
          <Aviso>
            No se pudo consultar el contrato. Revisa el RPC y el deployment de
            la red configurada.
          </Aviso>
        )}

        {passport.credential && passport.tokenId !== null && (
          <>
            <Row
              label="Emitido"
              value={`${formatTimestamp(passport.credential.issuedAt)} · vence ${formatTimestamp(passport.credential.expiresAt)}`}
            />
            <Row
              label="Pasaporte"
              value={`#${passport.tokenId.toString()} en ${
                passport.contractAddress
                  ? shortHash(passport.contractAddress, 5)
                  : "contrato no configurado"
              }`}
            />
          </>
        )}

        {evidence.evidence && (
          <Row
            label="Expediente legal"
            value={shortHash(evidence.evidence.legalPackHash, 6)}
          />
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {evidence.evidence && (
            <Button variant="outline" size="sm" onClick={checkHash}>
              Comprobar hash
            </Button>
          )}
          <HashResult result={hashCheck} />

          {explorer && passport.contractAddress && (
            <span className="ml-auto flex gap-2">
              <Enlace href={`${explorer}/address/${passport.contractAddress}`}>
                Ver contrato
              </Enlace>
              {passport.issuanceTxHash && (
                <Enlace href={`${explorer}/tx/${passport.issuanceTxHash}`}>
                  Ver emisión
                </Enlace>
              )}
            </span>
          )}
        </div>
      </Bloque>
    </div>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[var(--r-panel)] border border-border bg-surface-soft px-3 py-2 text-[12px] leading-relaxed text-mid">
      {children}
    </p>
  );
}

function Enlace({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="focusable inline-flex h-8 items-center rounded-[var(--r-input)] border border-border bg-surface px-2.5 text-[12px] font-medium text-hi transition-colors hover:border-border-strong hover:bg-surface-soft"
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
