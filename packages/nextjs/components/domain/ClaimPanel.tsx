"use client";

import { useState } from "react";
import type { Address } from "viem";
import { ArrowDownToLine, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Row } from "@/components/ui/Stat";
import { useCreditVault } from "@/hooks/useCreditVault";
import { useSession } from "@/lib/useSession";
import { formatUsdc } from "@/lib/format";

/**
 * Cobro de lo que devolvió una operación.
 *
 * Faltaba entero: se podía invertir contra el vault pero no retirar, así
 * que el circuito del inversionista terminaba a la mitad.
 *
 * Los montos salen de `getInvestorPosition`, que hace en el contrato la
 * MISMA cuenta que `claim` — así el botón dice la cifra exacta y no
 * invita a firmar algo que va a revertir.
 *
 * Limitación conocida: `useCreditVault` apunta hoy a un único vault
 * desplegado, no a uno por oportunidad. Mientras siga así, esto refleja
 * esa operación y no el portafolio completo — por eso lo dice en pantalla.
 */
export function ClaimPanel() {
  const { session } = useSession();
  const vault = useCreditVault(session?.address as Address | undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Sin vault desplegado o sin haber aportado nada, no hay nada que decir.
  if (!vault.address || !session) return null;
  if (vault.contributed === undefined || vault.contributed === 0n) return null;

  const claimable = vault.claimable ?? 0n;
  const canClaim = claimable > 0n && !busy;

  async function onClaim() {
    setBusy(true);
    setError(null);
    try {
      await vault.claim();
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo completar el cobro",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="h3">Cobro</h3>
          <p className="mt-1 text-[12.5px] text-mid">
            Lo que la operación ya devolvió y te corresponde por tu aporte.
          </p>
        </div>
        <ArrowDownToLine className="h-4 w-4 shrink-0 text-low" />
      </div>

      <div className="mt-3">
        <Row label="Aportado" value={`${formatUsdc(vault.contributed)} USDC`} />
        <Row label="Ya cobrado" value={`${formatUsdc(vault.claimed ?? 0n)} USDC`} />
        <Row
          label="Disponible ahora"
          value={`${formatUsdc(claimable)} USDC`}
          accent={claimable > 0n ? "var(--positive)" : undefined}
          strong
        />
      </div>

      {error && (
        <div
          className="mt-3 rounded-[var(--r-panel)] border px-3 py-2 text-[12.5px]"
          style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
        >
          {error}
        </div>
      )}

      {done && claimable === 0n ? (
        <div
          className="mt-4 flex items-center gap-2 text-[12.5px] font-medium"
          style={{ color: "var(--positive)" }}
        >
          <Check className="h-4 w-4" />
          Cobro completado
        </div>
      ) : (
        <Button
          className="mt-4 w-full"
          disabled={!canClaim}
          loading={busy}
          onClick={onClaim}
        >
          {claimable > 0n
            ? `Cobrar ${formatUsdc(claimable)} USDC`
            : "Todavía no hay nada que cobrar"}
        </Button>
      )}

      <p className="mt-2.5 text-[11.5px] text-low">
        Refleja el vault desplegado, todavía no uno por oportunidad.
      </p>
    </section>
  );
}
