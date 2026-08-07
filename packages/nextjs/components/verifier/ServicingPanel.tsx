"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Landmark, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { Row } from "@/components/ui/Stat";
import { formatUsdc, shortHash, usdc } from "@/lib/format";

/**
 * Administración del crédito: desembolso, repagos, incumplimiento y
 * recupero. El contrato ya sabía hacer todo esto; lo que faltaba era una
 * forma de dispararlo que no fuera un script.
 *
 * Solo se ofrecen las transiciones válidas para el estado actual — las
 * decide el servidor leyendo el vault, no esta pantalla.
 */

type VaultAction =
  | "openFunding"
  | "activate"
  | "recordRepayment"
  | "declareDefault"
  | "startRecovery"
  | "recordRecovery"
  | "close";

type VaultState = {
  address: string;
  status: number;
  statusLabel: string;
  totalFunded: string;
  principalOutstanding: string;
  totalRepaid: string;
  totalClaimable: string;
  totalClaimed: string;
  available: VaultAction[];
};

const ACTION_LABEL: Record<VaultAction, string> = {
  openFunding: "Abrir recaudación",
  activate: "Desembolsar y activar",
  recordRepayment: "Registrar repago",
  declareDefault: "Declarar incumplimiento",
  startRecovery: "Iniciar recupero",
  recordRecovery: "Registrar recupero",
  close: "Cerrar operación",
};

/** Las que mueven dinero desde la cuenta operadora piden monto. */
const NEEDS_AMOUNT: VaultAction[] = ["recordRepayment", "recordRecovery"];
const DESTRUCTIVE: VaultAction[] = ["declareDefault"];

const STATUS_TONE = (status: number) =>
  status === 5 ? "negative" : status === 4 || status === 3 ? "positive" : "neutral";

export function ServicingPanel({ apiKey }: { apiKey: string }) {
  const [state, setState] = useState<VaultState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<VaultAction | null>(null);
  const [amount, setAmount] = useState("");
  const [lastTx, setLastTx] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/servicing", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudo leer el estado del crédito");
        setState(null);
        return;
      }
      setState(body as VaultState);
    } catch {
      setError("No se pudo leer el estado del crédito");
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: VaultAction) {
    if (
      DESTRUCTIVE.includes(action) &&
      !window.confirm(
        "Declarar el incumplimiento es irreversible: el crédito pasa a default y solo queda el camino de recupero. ¿Continuar?",
      )
    ) {
      return;
    }

    setBusy(action);
    setError(null);
    setLastTx(null);
    try {
      const res = await fetch("/api/servicing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          action,
          amount: NEEDS_AMOUNT.includes(action)
            ? usdc(Number(amount.replace(/[^0-9.]/g, "")) || 0).toString()
            : undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "La operación falló");
        return;
      }
      setLastTx(body.hash as string);
      setAmount("");
      if (body.state) setState(body.state as VaultState);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card mt-6 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-mid" />
          <h2 className="h3">Administración del crédito</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={load}
          loading={loading}
        >
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

      {!state && !error && (
        <p className="mt-3 text-[12.5px] text-low">Leyendo el vault…</p>
      )}

      {state && (
        <>
          <div className="mt-3 flex items-center gap-2">
            <Pill
              label={state.statusLabel}
              tone={STATUS_TONE(state.status)}
              dot
            />
            <span className="num text-[11.5px] text-low">
              {shortHash(state.address, 6)}
            </span>
          </div>

          <div className="mt-3">
            <Row label="Recaudado" value={`${formatUsdc(BigInt(state.totalFunded))} USDC`} />
            <Row label="Principal vivo" value={`${formatUsdc(BigInt(state.principalOutstanding))} USDC`} />
            <Row label="Devuelto" value={`${formatUsdc(BigInt(state.totalRepaid))} USDC`} />
            <Row
              label="Disponible para inversionistas"
              value={`${formatUsdc(BigInt(state.totalClaimable))} USDC`}
              strong
            />
            <Row label="Ya cobrado" value={`${formatUsdc(BigInt(state.totalClaimed))} USDC`} />
          </div>

          {state.available.some((a) => NEEDS_AMOUNT.includes(a)) && (
            <div className="mt-3">
              <Field
                label="Monto"
                suffix="USDC"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                hint="Sale de la cuenta operadora, que debe tener saldo del token de pago"
              />
            </div>
          )}

          {state.available.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-low">
              No hay acciones disponibles en este estado.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {state.available.map((action) => (
                <Button
                  key={action}
                  size="sm"
                  variant={DESTRUCTIVE.includes(action) ? "danger" : "outline"}
                  loading={busy === action}
                  disabled={
                    busy !== null ||
                    (NEEDS_AMOUNT.includes(action) && !amount.trim())
                  }
                  icon={
                    DESTRUCTIVE.includes(action) ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : undefined
                  }
                  onClick={() => run(action)}
                >
                  {ACTION_LABEL[action]}
                </Button>
              ))}
            </div>
          )}

          {lastTx && (
            <p className="num mt-3 text-[11.5px]" style={{ color: "var(--positive)" }}>
              Confirmada: {shortHash(lastTx, 10)}
            </p>
          )}

          <p className="mt-3 text-[11px] text-low">
            Opera el vault desplegado, todavía no uno por oportunidad.
          </p>
        </>
      )}
    </section>
  );
}
