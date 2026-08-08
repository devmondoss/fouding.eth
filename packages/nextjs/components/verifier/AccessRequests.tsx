"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { shortHash } from "@/lib/format";

/**
 * Acceso de inversionistas: la otra mitad del KYC.
 *
 * Una wallet pide acceso desde ProfilePanel y quedaba en Pending para
 * siempre, porque `approveAccess` solo se llamaba desde el script de
 * deploy. Sin esta pantalla, en producción nadie podía invertir nunca.
 */

type AccessRequest = {
  investor: string;
  applicationHash: string;
  status: 0 | 1 | 2 | 3 | 4;
  requestedAt: number;
  updatedAt: number;
  /** Identidad declarada, de la base. Null si no dejó registro. */
  fullName: string | null;
  documentId: string | null;
  /** false = lo declarado no coincide con el hash anclado en cadena. */
  hashMatches: boolean | null;
};

const STATUS: Record<
  AccessRequest["status"],
  { label: string; tone: "neutral" | "warning" | "positive" | "negative" }
> = {
  0: { label: "Sin solicitud", tone: "neutral" },
  1: { label: "Pendiente", tone: "warning" },
  2: { label: "Aprobado", tone: "positive" },
  3: { label: "Rechazado", tone: "negative" },
  4: { label: "Revocado", tone: "negative" },
};

export function AccessRequests({ apiKey }: { apiKey: string }) {
  const [requests, setRequests] = useState<AccessRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/compliance/access", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudieron leer las solicitudes");
        setRequests([]);
        return;
      }
      setRequests(body as AccessRequest[]);
    } catch {
      setError("No se pudieron leer las solicitudes");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(investor: string, approve: boolean) {
    setBusy(investor);
    setError(null);
    try {
      const res = await fetch("/api/compliance/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ investor, approve }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudo registrar la decisión");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card mt-6 p-4">
      {/* El escudo delante del título y la línea que explicaba el
          AccessRegistry se fueron: el operador de esta pantalla sabe qué
          hace aprobar, y el título ya nombra la sección. */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="h3">Acceso de inversionistas</h2>
        <Button variant="ghost" size="sm" onClick={load} loading={loading}>
          Actualizar
        </Button>
      </div>

      {error && (
        <div
          className="mt-3 rounded-[var(--r-panel)] border px-3 py-2 text-[12.5px]"
          style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
        >
          {error}
        </div>
      )}

      {requests?.length === 0 && !error && (
        <p className="mt-3 text-[12.5px] text-low">
          Ninguna wallet solicitó acceso todavía.
        </p>
      )}

      <div className="mt-3 flex flex-col">
        {requests?.map((r) => (
          <div
            key={r.investor}
            className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-0 last:pb-0"
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-hi">
                {r.fullName ?? "Sin identidad declarada"}
              </div>
              <div className="text-[12px] text-mid">
                {r.documentId ? `Doc. ${r.documentId} · ` : ""}
                <span className="num">{shortHash(r.investor, 6)}</span>
              </div>
              {r.hashMatches === false && (
                <div
                  className="mt-0.5 text-[11px] font-medium"
                  style={{ color: "var(--negative)" }}
                >
                  Lo declarado no coincide con el hash anclado en cadena
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Pill
                label={STATUS[r.status].label}
                tone={STATUS[r.status].tone}
                dot
              />
              {r.status === 1 && (
                <>
                  <Button
                    size="sm"
                    loading={busy === r.investor}
                    onClick={() => decide(r.investor, true)}
                  >
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busy === r.investor}
                    onClick={() => decide(r.investor, false)}
                  >
                    Rechazar
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
