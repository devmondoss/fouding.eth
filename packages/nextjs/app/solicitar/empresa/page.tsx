"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AcreditarEmpresa } from "@/components/flow/AcreditarEmpresa";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import { useSession } from "@/lib/useSession";
import type { Company } from "@/lib/verifier/companies";

/**
 * Acreditar la empresa tiene URL propia, igual que armar un expediente.
 * Es el trámite que hay que pasar antes de poder pedir financiamiento.
 */
export default function AcreditarEmpresaPage() {
  const { session, getAccessToken } = useSession();
  const router = useRouter();
  const [empresa, setEmpresa] = useState<Company | null | undefined>(undefined);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) router.replace("/negocios/login");
    else if (session.role === "investor") router.replace("/solicitar");
  }, [session, router]);

  // Se carga la empresa para saber si esto es un alta o una corrección
  // tras un rechazo — y para no dejar reenviar una ya acreditada.
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
      if (data?.status === "verified" || data?.status === "in_review") {
        router.replace("/solicitar");
        return;
      }
      setEmpresa(data);
    })().catch(() => alive && setEmpresa(null));
    return () => {
      alive = false;
    };
  }, [session, getAccessToken, router]);

  if (
    session === undefined ||
    session === null ||
    session.role !== "business" ||
    empresa === undefined
  ) {
    return <FullScreenLoader />;
  }

  return (
    <AcreditarEmpresa
      address={session.address}
      empresa={empresa}
      onCancel={() => router.push("/solicitar")}
      onDone={() => router.push("/solicitar")}
    />
  );
}
