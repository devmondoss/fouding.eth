"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BusinessAuthFlow } from "@/components/flow/BusinessAuthFlow";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import { useSession } from "@/lib/useSession";

/**
 * Pantalla de /negocios/login. El login del lado empresa tiene URL propia
 * a propósito: antes vivía dentro de /solicitar, así que la barra de
 * direcciones decía "solicitar" mientras la pantalla pedía correo (ver
 * conversación de agosto 2026). Una URL debe describir lo que se ve.
 */
export function BusinessLoginScreen() {
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!session) return;
    router.replace(session.role === null ? "/rol" : "/solicitar");
  }, [session, router]);

  if (session === undefined || session) return <FullScreenLoader />;

  return <BusinessAuthFlow />;
}
