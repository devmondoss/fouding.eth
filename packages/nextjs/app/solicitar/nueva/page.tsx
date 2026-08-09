"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SolicitudWizard } from "@/components/flow/SolicitudWizard";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import { useSession } from "@/lib/useSession";

/**
 * Armar un expediente tiene URL propia.
 *
 * Vivía como modal encima de /solicitar: cuatro pasos, un legajo entero y
 * un comprobante final, todo dentro de 580px flotantes con el panel
 * asomando por los bordes. No es una interrupción de otra cosa — es EL
 * trabajo de esta persona, y la barra de direcciones tiene que decirlo
 * (misma regla que separó /negocios, /rol y /solicitar; ver
 * scripts/check-routes.mjs).
 *
 * Con URL propia además se puede volver, recargar sin perder la pantalla,
 * y enlazarla desde donde haga falta.
 */
export default function NuevaSolicitudPage() {
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) router.replace("/negocios/login");
    else if (session.role === "investor") router.replace("/");
  }, [session, router]);

  if (session === undefined || session === null || session.role !== "business") {
    return <FullScreenLoader />;
  }

  return (
    <SolicitudWizard
      address={session.address}
      onClose={() => router.push("/solicitar")}
      onSubmitted={() => router.push("/solicitar")}
    />
  );
}
