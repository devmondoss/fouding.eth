"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { BusinessDashboard } from "@/components/flow/BusinessDashboard";
import { Onboarding, SLIDES_EMPRESA } from "@/components/flow/Onboarding";
import { RoleConflict } from "@/components/flow/RoleConflict";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import { useOnce } from "@/lib/useOnce";
import { useSession } from "@/lib/useSession";
import type { Company } from "@/lib/verifier/companies";
import type { SubmissionWithEvents } from "@/lib/verifier/types";

/**
 * Panel del dueño de negocio — deliberadamente FUERA del módulo único
 * del inversionista (docs/design-system.md §6), igual que app/verifier.
 *
 * Esta ruta ahora hace UNA sola cosa: mostrar tus solicitudes. Todo lo
 * demás vive en su propia URL, porque la barra de direcciones tiene que
 * describir lo que se ve (ver conversación de agosto 2026):
 *
 *   /negocios         página pública de venta
 *   /login            la puerta: el único login, de los dos lados
 *   /rol              elegir inversionista o empresa (una vez por wallet)
 *   /solicitar        ← acá: el panel, ya con sesión y rol de empresa
 *
 * Antes las cuatro pantallas vivían en /solicitar y cuál te tocaba
 * dependía de la sesión y de un flag de localStorage, así que la URL
 * mentía sobre lo que estabas viendo.
 *
 * Llama las mismas rutas que el panel del verificador
 * (/api/verifier/submissions, /api/verifier/documents) pero sin la API
 * key — esas dos (más /submissions/mine, para ver el estado) están
 * abiertas a propósito para esto, protegidas solo por rate limit (ver
 * lib/verifier/auth.ts). El resto del backend del verificador (listar
 * todo, decidir, descargar documentos) sigue exigiendo la key: esta
 * página nunca los toca.
 */
export default function SolicitarPage() {
  const { session, signOut, switchAccount } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session === undefined) return;
    // Sin sesión se sale por la puerta, que es la única que hay. Antes
    // esto mandaba a un login de empresa aparte: cerrar sesión desde acá
    // y desde el catálogo te dejaba en dos pantallas distintas, y la de
    // empresa encima te encerraba en un lado antes de preguntarte si es
    // el tuyo. Ese login se borró.
    if (session === null) router.replace("/login");
    else if (session.role === null) router.replace("/rol");
    // Una cuenta de inversionista NO se redirige en silencio: se le dice
    // por qué no puede estar acá. Rebotarla a `/` la dejaba mirando el
    // catálogo sin saber qué pasó con el enlace que había abierto.
  }, [session, router]);

  if (session?.role === "investor") {
    return (
      <RoleConflict
        pedido="business"
        real="investor"
        onContinuar={() => router.replace("/oportunidades")}
        onOtraCuenta={switchAccount}
      />
    );
  }

  if (session === undefined || session === null || session.role !== "business") {
    return <FullScreenLoader />;
  }

  return <SolicitarHome address={session.address} onSignOut={signOut} />;
}

function SolicitarHome({ address, onSignOut }: { address: string; onSignOut: () => void }) {
  const [mine, setMine] = useState<SubmissionWithEvents[] | null>(null);
  const [empresa, setEmpresa] = useState<Company | null | undefined>(undefined);
  const { getAccessToken } = useSession();
  const router = useRouter();

  /**
   * El lado empresa no tenía introducción: se caía en un panel con un
   * botón de "Acreditar mi empresa" y ninguna explicación de por qué hay
   * dos trámites, qué se le va a pedir ni cómo llega el dinero. El
   * inversionista sí la tenía desde el principio.
   *
   * Marca por wallet y no por navegador, por lo mismo que del otro lado:
   * en un stand el teléfono es uno y las personas son muchas.
   */
  const intro = useOnce(`founding.intro.negocio.${address.toLowerCase()}`);

  useEffect(() => {
    let alive = true;
    setMine(null);
    fetch(`/api/verifier/submissions/mine?wallet=${address}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => alive && setMine(data))
      .catch(() => alive && setMine([]));
    return () => {
      alive = false;
    };
  }, [address]);

  // La empresa manda: sin acreditación no hay solicitud que valga, así
  // que el panel la necesita para saber qué ofrecer.
  useEffect(() => {
    let alive = true;
    (async () => {
      const token = await getAccessToken();
      if (!token || !alive) return;
      const res = await fetch("/api/company", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (alive) setEmpresa(res.ok ? ((await res.json()) as Company | null) : null);
    })().catch(() => alive && setEmpresa(null));
    return () => {
      alive = false;
    };
  }, [getAccessToken]);

  return (
    <>
      {/* Encima del panel, no en vez de él: al cerrarla la persona queda
          donde iba a quedar, con sus datos ya cargados detrás. */}
      <AnimatePresence>
        {intro.seen === false && (
          <Onboarding slides={SLIDES_EMPRESA} onDone={intro.markSeen} />
        )}
      </AnimatePresence>

      <BusinessDashboard
        address={address}
        submissions={mine}
        empresa={empresa}
        loading={mine === null || empresa === undefined}
        onSignOut={onSignOut}
      // Ninguno de los dos se abre encima de esto: los dos tienen su
      // propia ruta. Al volver, esta pantalla se monta de nuevo y vuelve a
      // pedir los datos, así que lo recién enviado aparece sin necesidad
      // de una llave de refresco.
        onNewSubmission={() => router.push("/solicitar/nueva")}
        onAcreditar={() => router.push("/solicitar/empresa")}
      />
    </>
  );
}
