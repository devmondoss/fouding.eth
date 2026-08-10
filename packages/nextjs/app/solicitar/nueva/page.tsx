"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SolicitudWizard } from "@/components/flow/SolicitudWizard";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import { useSession } from "@/lib/useSession";
import type { Company } from "@/lib/verifier/companies";

/**
 * Pedir financiamiento tiene URL propia, y exige empresa acreditada.
 *
 * Vivía como modal encima de /solicitar: tres pasos y un comprobante
 * dentro de 580px flotantes, con el panel asomando por los bordes. No es
 * una interrupción de otra cosa — es EL trabajo de esta persona, y la
 * barra de direcciones tiene que decirlo (misma regla que separó
 * /negocios, /rol y /solicitar; ver scripts/check-routes.mjs).
 *
 * La empresa se carga acá y no dentro del asistente: si todavía no está
 * acreditada, esta pantalla no llega a montarse. El servidor rechaza
 * igual con 409, pero mandar a alguien a llenar tres pasos para
 * frenarlo al final sería una trampa.
 */
export default function NuevaSolicitudPage() {
  const { session, getAccessToken } = useSession();
  const router = useRouter();
  const [empresa, setEmpresa] = useState<Company | null | undefined>(undefined);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) router.replace("/login");
    else if (session.role === "investor") router.replace("/solicitar");
  }, [session, router]);

  useEffect(() => {
    if (session?.role !== "business") return;
    let alive = true;
    (async () => {
      const token = await getAccessToken();
      if (!token || !alive) return;
      const res = await fetch("/api/company", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.ok ? ((await res.json()) as Company | null) : null;
      if (!alive) return;
      // Sin acreditación no hay solicitud: se manda al trámite que
      // corresponde en vez de dejar llenar un formulario que no se puede
      // enviar.
      if (data?.status !== "verified") {
        router.replace(data ? "/solicitar" : "/solicitar/empresa");
        return;
      }
      setEmpresa(data);
    })().catch(() => alive && router.replace("/solicitar"));
    return () => {
      alive = false;
    };
  }, [session, getAccessToken, router]);

  if (
    session === undefined ||
    session === null ||
    session.role !== "business" ||
    !empresa
  ) {
    return <FullScreenLoader />;
  }

  return (
    <SolicitudWizard
      empresa={empresa}
      onClose={() => router.push("/solicitar")}
      onSubmitted={() => router.push("/solicitar")}
    />
  );
}
