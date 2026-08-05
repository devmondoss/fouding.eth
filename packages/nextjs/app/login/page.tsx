"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthFlow } from "@/components/flow/AuthFlow";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import { useSession } from "@/lib/useSession";

/**
 * URL directa a la pantalla de login del inversionista — el mismo
 * AuthFlow que ya se muestra automáticamente en `/` cuando no hay
 * sesión. Existe como ruta propia para poder enlazarla directo (ej.
 * desde fuera de la app), no porque el flujo normal la necesite: en
 * `/` el login sigue apareciendo solo, sin pasar por acá.
 *
 * El equivalente del lado empresa es /negocios/login.
 */
export default function LoginPage() {
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!session) return;
    // Respeta el rol ya elegido: mandar a `/` a una wallet de empresa
    // solo la haría rebotar de vuelta a /solicitar.
    if (session.role === null) router.replace("/rol");
    else router.replace(session.role === "business" ? "/solicitar" : "/");
  }, [session, router]);

  if (session === undefined || session) return <FullScreenLoader />;

  return <AuthFlow />;
}
