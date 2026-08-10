"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Waiting } from "@/components/ui/Waiting";
import { usePlatform } from "@/lib/data/store";
import { formatRelativeTime, formatUsdc } from "@/lib/format";
import { useFocusTrap, useLayerKeys } from "@/lib/keyboard";
import { scrim, sheet } from "@/lib/motion";
import { RevisionAcceso } from "@/components/flow/RevisionAcceso";
import { useSession, type PasoRevision, type Session } from "@/lib/useSession";

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
}: {
  session: Session;
  /** Abre directo en el formulario de acceso. Lo usa el bloqueo de
   *  verificación de InvestPanel: llegar acá y tener que buscar el botón
   *  era la mitad del problema. */
  openAccessRequest?: boolean;
  onClose: () => void;
  onSignOut: () => void;
  /** Recibe un segundo argumento para que el trámite pueda contarse
   *  mientras ocurre, en vez de resolverse detrás de un botón ocupado. */
  onVerify: (
    applicant: { fullName: string; documentId: string },
    onPaso?: (paso: PasoRevision) => void,
  ) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
}) {
  const { positions } = usePlatform();
  // `session` llega por prop, pero esto no: es un estado en vuelo del
  // proveedor, no un dato de la sesión, y pasarlo como prop obligaría a
  // que la pantalla de arriba lo conozca solo para reenviarlo.
  const { resolvingAccess } = useSession();
  const [verifying, setVerifying] = useState(
    openAccessRequest && !session.verified && session.accessStatus !== 1,
  );
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [docId, setDocId] = useState("");
  const [verificationError, setVerificationError] = useState<string | null>(null);
  /** null = el modal todavía es el formulario. Con valor, es el trámite. */
  const [paso, setPaso] = useState<PasoRevision | null>(null);
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
    // El modal deja de ser un formulario y pasa a ser el trámite. No se
    // cierra al enviar: enviar es justo cuando empieza lo que vale la
    // pena mirar (ver RevisionAcceso).
    setPaso({ etapa: "declarando" });
    try {
      await onVerify({ fullName: name.trim(), documentId: docId.trim() }, setPaso);
    } catch (cause) {
      setPaso(null);
      setVerificationError(
        cause instanceof Error ? cause.message : "No se pudo registrar la solicitud",
      );
    } finally {
      setBusy(false);
    }
  }

  /** Cierra el trámite y deja el panel limpio para la próxima vez. */
  function cerrarRevision() {
    setVerifying(false);
    setPaso(null);
    setName("");
    setDocId("");
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

          {/* ── El estado se nombra por lo que te DEJA HACER ──────────
              Decía "Acceso de inversionista aprobado": el trámite, no la
              consecuencia. A quien lo lee no le importa el nombre del
              permiso, le importa si puede poner capital — y esa es además
              la regla que el resto del producto ya sigue ("Con acceso" /
              "Sin acceso" en la barra dice lo mismo en dos palabras).

              Y deja de ser una tarjeta con borde. El estado es UNA línea:
              encerrarla en un panel le daba el objeto más grande de la
              pantalla a lo que menos se toca, mientras las dos acciones
              reales quedaban al fondo. Cuando hay algo que hacer —pedir
              acceso, o esperar— aparece debajo; cuando no, es una línea y
              se acabó. */}
          <div className="mt-6">
            <div
              className="text-[15px] font-semibold tracking-[-0.01em]"
              style={{
                color: session.verified ? "var(--positive)" : "var(--text-hi)",
              }}
            >
              {session.verified
                ? "Puedes invertir"
                : session.accessStatus === 1
                  ? "Todavía no puedes invertir"
                  : "Necesitas acceso para invertir"}
            </div>

            {session.verified && (
              /* Aprobado, sí — pero por una regla automática, no por una
                 persona que miró tu documento. Callarlo dejaría en pantalla
                 una afirmación que el producto no puede sostener, y decirlo
                 cuesta una línea. Misma regla que "Catálogo de
                 demostración". */
              <p className="mt-1 text-[12.5px] leading-relaxed text-low">
                Revisión automática, no humana. En producción este paso lo
                hace una persona contra tu documento.
              </p>
            )}

            {session.accessStatus === 1 &&
              (resolvingAccess ? (
                <div className="mt-2.5">
                  <Waiting label="Resolviendo tu solicitud" showLabel />
                </div>
              ) : (
                <p className="mt-1 text-[12.5px] leading-relaxed text-mid">
                  Tu solicitud se resuelve sola en unos segundos. Explorar el
                  catálogo no depende de eso.
                </p>
              ))}

            {!session.verified && session.accessStatus !== 1 && (
              <>
                <p className="mt-1 text-[12.5px] leading-relaxed text-mid">
                  Explorar es libre. Comprometer capital exige una
                  verificación de un minuto.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setVerifying(true)}
                >
                  Solicitar acceso
                </Button>
              </>
            )}
          </div>

          {/* ── Actividad ────────────────────────────────────────────────
              Eran dos tarjetas con borde diciendo "0 USDC" y "0
              operaciones" — la plantilla de cifra-grande-etiqueta-chica
              que el sistema descarta, y encima en cero: a alguien que
              acaba de entrar se le daba el mejor sitio del panel para
              informarle que no tiene nada. En cero no hay dato que
              mostrar, así que se dice qué hacer; con actividad, las cifras
              van en una fila de texto, que es todo lo que una suma de dos
              números necesita. */}
          <div className="mt-6 border-t border-border pt-5">
            {positions.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-mid">
                Todavía no tienes posiciones. Cada operación del catálogo
                muestra su garantía y su orden de pago antes de que pongas
                un sol.
              </p>
            ) : (
              <dl className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[13px] text-mid">Invertido histórico</dt>
                  <dd className="num text-[14px] font-semibold text-hi">
                    {formatUsdc(totalInvested)}{" "}
                    <span className="text-[11.5px] font-normal text-low">
                      USDC
                    </span>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[13px] text-mid">Posiciones abiertas</dt>
                  <dd className="num text-[14px] font-semibold text-hi">
                    {positions.length}
                  </dd>
                </div>
              </dl>
            )}
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
        // Mientras el trámite corre no se puede cerrar tocando afuera:
        // hay dos firmas en vuelo y cerrar no las cancela, solo esconde
        // lo único que está contando qué pasa.
        onClose={paso && paso.etapa !== "listo" && paso.etapa !== "fallo"
          ? () => {}
          : cerrarRevision}
        title={paso ? "Revisando tu acceso" : "Solicitud de acceso"}
        footer={
          paso ? (
            paso.etapa === "listo" || paso.etapa === "fallo" ? (
              <Button onClick={cerrarRevision}>
                {paso.etapa === "listo" ? "Empezar a invertir" : "Entendido"}
              </Button>
            ) : null
          ) : (
            <>
              <Button variant="ghost" onClick={cerrarRevision}>
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
          )
        }
      >
        {paso ? (
          <RevisionAcceso paso={paso} />
        ) : (
          <>
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
            {/* Lo que se dice es qué pasa con los datos de la persona, no
                cómo funciona el anclaje criptográfico. Una línea.

                Y ya no dice "la revisión la hace una persona": desde que
                se resuelve sola, eso era falso justo en la pantalla donde
                la persona entrega su documento. */}
            <p className="mt-4 text-[12px] leading-relaxed text-low">
              Tus datos no van a la blockchain: en cadena queda solo su
              huella. La revisión se resuelve en unos segundos.
            </p>
            {verificationError && (
              <p className="mt-3 text-[12px] text-[var(--negative)]">
                {verificationError}
              </p>
            )}
          </>
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
