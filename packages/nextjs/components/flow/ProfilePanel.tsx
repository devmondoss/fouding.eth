"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Metric } from "@/components/ui/Stat";
import { Modal } from "@/components/ui/Modal";
import { usePlatform } from "@/lib/data/store";
import { formatRelativeTime, formatUsdc } from "@/lib/format";
import { useFocusTrap, useLayerKeys } from "@/lib/keyboard";
import { scrim, sheet } from "@/lib/motion";
import type { Session } from "@/lib/useSession";

/**
 * Módulo dedicado a la cuenta. No es un dropdown: es el lugar donde vive la
 * identidad de la wallet, su estado de verificación y la actividad
 * histórica del inversionista — separado del portafolio, que es sobre las
 * posiciones, no sobre la cuenta.
 */
export function ProfilePanel({
  session,
  openAccessRequest = false,
  onClose,
  onSignOut,
  onVerify,
  onDeleteAccount,
  onReplayIntro,
}: {
  session: Session;
  /** Abre directo en el formulario de acceso. Lo usa el bloqueo de
   *  verificación de InvestPanel: llegar acá y tener que buscar el botón
   *  era la mitad del problema. */
  openAccessRequest?: boolean;
  onClose: () => void;
  onSignOut: () => void;
  onVerify: (applicant: { fullName: string; documentId: string }) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onReplayIntro: () => void;
}) {
  const { positions } = usePlatform();
  const [verifying, setVerifying] = useState(
    openAccessRequest && !session.verified && session.accessStatus !== 1,
  );
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [docId, setDocId] = useState("");
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useLayerKeys({ onEscape: onClose });
  const panelRef = useFocusTrap<HTMLElement>(true);

  const totalInvested = positions.reduce((s, p) => s + p.principal, 0n);

  async function submitVerification() {
    setBusy(true);
    setVerificationError(null);
    try {
      await onVerify({ fullName: name.trim(), documentId: docId.trim() });
      setVerifying(false);
    } catch (cause) {
      setVerificationError(
        cause instanceof Error ? cause.message : "No se pudo registrar la solicitud",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteAccount();
    } catch (err) {
      setDeleting(false);
      setDeleteError(
        err instanceof Error ? err.message : "No se pudo eliminar la cuenta",
      );
    }
  }

  return (
    <>
      <motion.div
        variants={scrim}
        initial="hidden"
        animate="show"
        exit="exit"
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(16,24,40,0.3)" }}
      />

      <motion.aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Cuenta"
        variants={sheet}
        initial="hidden"
        animate="show"
        exit="exit"
        className="fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-border sm:w-[400px]"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-border px-5">
          <h2 className="h2 text-[16px]">Cuenta</h2>
          <button
            onClick={onClose}
            className="focusable -mr-1 flex h-8 items-center rounded-[var(--r-input)] px-2 text-[12.5px] text-mid transition-colors hover:bg-surface-soft hover:text-hi"
          >
            Cerrar
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
                {/* El par de íconos copiar/check se leía igual antes y
                    después de copiar: dos glifos de 12px que solo cambian de
                    silueta. La palabra dice cuál de los dos estados es. */}
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(session.address);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  }}
                  className="focusable shrink-0 text-[11.5px] font-medium text-low transition-colors hover:text-hi"
                >
                  {copied ? "Copiada" : "Copiar"}
                </button>
              </div>
              <div className="text-[11.5px] text-low">
                Cuenta creada {formatRelativeTime(session.createdAt)}
              </div>
            </div>
          </div>

          {/* Verificación. Los tres párrafos que glosaban el estado se
              fueron: cada uno decía en prosa lo que el titular ya afirma, y
              el que importa —el pendiente— tenía el botón debajo de tres
              líneas de texto que nadie necesita para pulsarlo. */}
          <div className="mt-5 rounded-[var(--r-panel)] border border-border p-4">
            <div
              className="text-[13px] font-semibold"
              style={{
                color: session.verified ? "var(--positive)" : "var(--text-hi)",
              }}
            >
              {session.verified
                ? "Acceso de inversionista aprobado"
                : session.accessStatus === 1
                  ? "Solicitud en revisión"
                  : "Acceso de inversionista pendiente"}
            </div>

            {/* Aprobado, sí — pero por una regla automática, no por una
                persona que miró tu documento. Callarlo dejaría en pantalla
                una afirmación que el producto no puede sostener, y decirlo
                cuesta una línea. Es la misma regla que sostiene "Catálogo
                de demostración" y "Declarado". */}
            {session.verified && (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-mid">
                Revisión automática, no humana. En producción este paso lo
                hace una persona contra tu documento.
              </p>
            )}
            {/* En revisión no hay botón. Había uno que decía "Solicitud
                pendiente" — un control que nombra un ESTADO en vez de una
                acción, y que al pulsarlo reabría el formulario ya enviado,
                o sea que invitaba a mandar dos veces lo mismo. Lo que hace
                falta ahí no es un botón: es la consecuencia, que es lo
                único que cambia lo que la persona puede hacer ahora. El
                procedimiento interno —quién revisa y contra qué— no se
                cuenta (docs/design-system.md §5.2). */}
            {session.accessStatus === 1 ? (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-mid">
                Puedes seguir explorando el catálogo. Comprometer capital
                queda bloqueado hasta que se apruebe.
              </p>
            ) : (
              !session.verified && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setVerifying(true)}
                >
                  Solicitar acceso
                </Button>
              )
            )}
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
              className="focusable w-full rounded-[var(--r-panel)] border border-border px-3.5 py-3 text-left text-[13px] text-hi transition-colors hover:bg-surface-soft"
            >
              Ver la introducción de nuevo
            </button>
          </div>
        </div>

        {/* Sesión */}
        <div className="shrink-0 border-t border-border p-5">
          <button
            onClick={onSignOut}
            className="focusable w-full rounded-[var(--r-input)] border border-border py-2.5 text-[13px] text-mid transition-colors hover:border-[var(--negative)] hover:text-[var(--negative)]"
          >
            Cerrar sesión
          </button>
          <button
            onClick={() => {
              setDeleteError(null);
              setConfirmingDelete(true);
            }}
            className="focusable mt-2 w-full py-2 text-[12px] text-low transition-colors hover:text-[var(--negative)]"
          >
            Eliminar cuenta
          </button>
        </div>
      </motion.aside>

      {/* La PII no se publica onchain; solo se registra un hash de solicitud. */}
      <Modal
        open={verifying}
        onClose={() => setVerifying(false)}
        title="Solicitud de acceso"
        footer={
          <>
            <Button variant="ghost" onClick={() => setVerifying(false)}>
              Cancelar
            </Button>
            <Button
              loading={busy}
              disabled={
                session.accessStatus === 1 ||
                name.trim().length < 3 ||
                docId.trim().length < 3
              }
              onClick={submitVerification}
            >
              Registrar solicitud
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
        {/* Lo que se dice es qué pasa con los datos de la persona, no cómo
            funciona el anclaje criptográfico. Una línea. */}
        <p className="mt-4 text-[12px] leading-relaxed text-low">
          Tus datos no van a la blockchain: en cadena queda solo su huella. La
          revisión la hace una persona.
        </p>
        {verificationError && (
          <p className="mt-3 text-[12px] text-[var(--negative)]">
            {verificationError}
          </p>
        )}
      </Modal>

      {/* Eliminar cuenta — irreversible: borra el usuario en Privy de
          verdad, no solo datos locales (ver lib/useSession.tsx). */}
      <Modal
        open={confirmingDelete}
        onClose={() => (deleting ? null : setConfirmingDelete(false))}
        title="Eliminar cuenta"
        subtitle="Esta acción no se puede deshacer"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={deleting}
              onClick={() => setConfirmingDelete(false)}
            >
              Cancelar
            </Button>
            <Button variant="danger" loading={deleting} onClick={handleDeleteAccount}>
              Eliminar mi cuenta
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-mid">
          Se borra tu wallet y tu historial de esta cuenta — no se puede
          recuperar. Tu correo queda libre para registrarse de nuevo.
        </p>
        {deleteError && (
          <p className="mt-3 text-[12.5px]" style={{ color: "var(--negative)" }}>
            {deleteError}
          </p>
        )}
      </Modal>
    </>
  );
}
