"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  Copy,
  HelpCircle,
  LogOut,
  ShieldCheck,
  ShieldEllipsis,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Metric } from "@/components/ui/Stat";
import { Modal } from "@/components/ui/Modal";
import { usePlatform } from "@/lib/data/store";
import { formatUsdc, usdc } from "@/lib/format";
import { UNVERIFIED_TICKET_CAP, type Session } from "@/lib/useSession";

/**
 * Módulo dedicado a la cuenta. No es un dropdown: es el lugar donde vive la
 * identidad de la wallet, su estado de verificación y la actividad
 * histórica del inversionista — separado del portafolio, que es sobre las
 * posiciones, no sobre la cuenta.
 */
export function ProfilePanel({
  session,
  onClose,
  onSignOut,
  onVerify,
  onReplayIntro,
}: {
  session: Session;
  onClose: () => void;
  onSignOut: () => void;
  onVerify: () => void;
  onReplayIntro: () => void;
}) {
  const { positions, activity } = usePlatform();
  const [verifying, setVerifying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [docId, setDocId] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const memberDays = Math.max(
    0,
    Math.floor((Date.parse("2026-08-04") - Date.parse(session.createdAt)) / 86_400_000),
  );

  const totalInvested = positions.reduce((s, p) => s + p.principal, 0n);

  async function submitVerification() {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 900));
    setBusy(false);
    setVerifying(false);
    onVerify();
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(16,24,40,0.3)" }}
      />

      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.32, ease: [0.22, 0.9, 0.3, 1] }}
        className="fixed right-0 top-0 z-50 flex h-full w-[400px] flex-col border-l border-border"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-border px-5">
          <h2 className="h2 text-[16px]">Cuenta</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border transition-colors hover:bg-surface-soft"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4 text-mid" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* Identidad */}
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-bold"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
            >
              {session.address.slice(2, 4).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="num truncate text-[13px] font-semibold text-hi">
                  {session.address.slice(0, 8)}…{session.address.slice(-6)}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(session.address);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  }}
                  className="shrink-0 text-low transition-colors hover:text-hi"
                  aria-label="Copiar dirección"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
              <div className="text-[11.5px] text-low">
                Cuenta creada hace {memberDays} {memberDays === 1 ? "día" : "días"}
              </div>
            </div>
          </div>

          {/* Verificación */}
          <div className="mt-5 rounded-[var(--r-panel)] border border-border p-4">
            <div className="flex items-start gap-2.5">
              {session.verified ? (
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--positive)" }} />
              ) : (
                <ShieldEllipsis className="mt-0.5 h-4 w-4 shrink-0 text-low" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-hi">
                  {session.verified ? "Identidad verificada" : "Identidad sin verificar"}
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-mid">
                  {session.verified
                    ? "Puedes invertir sin límite de ticket por operación."
                    : `Con tu cuenta puedes invertir hasta ${formatUsdc(usdc(UNVERIFIED_TICKET_CAP))} USDC por operación. Verifica tu identidad para acceder a montos mayores.`}
                </p>
                {!session.verified && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => setVerifying(true)}
                  >
                    Verificar identidad
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="card px-4 py-3.5">
              <Metric label="Invertido histórico" value={formatUsdc(totalInvested)} unit="USDC" size="sm" />
            </div>
            <div className="card px-4 py-3.5">
              <Metric label="Posiciones" value={positions.length} unit="operaciones" size="sm" />
            </div>
          </div>

          {/* Preferencias */}
          <div className="mt-5">
            <div className="label mb-2">Preferencias</div>
            <button
              onClick={onReplayIntro}
              className="flex w-full items-center gap-2.5 rounded-[var(--r-panel)] border border-border px-3.5 py-3 text-left transition-colors hover:bg-surface-soft"
            >
              <HelpCircle className="h-4 w-4 shrink-0 text-low" />
              <span className="text-[13px] text-hi">Ver introducción de nuevo</span>
            </button>
          </div>
        </div>

        {/* Sesión */}
        <div className="shrink-0 border-t border-border p-5">
          <button
            onClick={onSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--r-input)] border border-border py-2.5 text-[13px] text-mid transition-colors hover:border-[var(--negative)] hover:text-[var(--negative)]"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesión
          </button>
        </div>
      </motion.aside>

      {/* Verificación de identidad — mock: sin KYC real detrás */}
      <Modal
        open={verifying}
        onClose={() => setVerifying(false)}
        title="Verificación de identidad"
        subtitle="Requerida para invertir montos mayores por operación"
        footer={
          <>
            <Button variant="ghost" onClick={() => setVerifying(false)}>
              Cancelar
            </Button>
            <Button
              loading={busy}
              disabled={name.trim().length < 3 || docId.trim().length < 3}
              onClick={submitVerification}
            >
              Enviar
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field
            label="Nombre completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre y apellido"
          />
          <Field
            label="Documento de identidad"
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            placeholder="DNI o pasaporte"
          />
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-low">
          Prototipo: no se realiza una verificación de identidad real. En
          producción este paso se resolvería con un proveedor de KYC
          certificado.
        </p>
      </Modal>
    </>
  );
}
