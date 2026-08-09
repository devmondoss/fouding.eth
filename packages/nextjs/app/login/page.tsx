"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { StandGate } from "@/components/flow/StandGate";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import { useSession } from "@/lib/useSession";

/**
 * URL directa a la puerta de entrada — la misma `StandGate` que ya se
 * muestra automáticamente en `/` cuando no hay sesión. Existe como ruta
 * propia para poder enlazarla directo (ej. el QR del stand), no porque
 * el flujo normal la necesite.
 *
 * Es la misma pantalla y no una variante: dos puertas distintas para el
 * mismo momento es exactamente el "un estado, un nombre" que el sistema
 * prohíbe (docs/design-system.md §9). Antes acá vivía `AuthFlow`, que
 * pedía una wallet antes de preguntar a qué venías.
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

  return <StandGate />;
}
