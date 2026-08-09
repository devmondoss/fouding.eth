"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BusinessDashboard } from "@/components/flow/BusinessDashboard";
import { RoleConflict } from "@/components/flow/RoleConflict";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
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
 *   /negocios/login   login de empresa
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
    if (session === null) router.replace("/negocios/login");
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
        onContinuar={() => router.replace("/")}
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
  );
}
