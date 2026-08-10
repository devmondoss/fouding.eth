"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { homeFor } from "@/lib/routes";
import { StandGate } from "@/components/flow/StandGate";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import { useSession } from "@/lib/useSession";

/**
 * La puerta de entrada. **Es la única pantalla que la sirve**: la raíz ya
 * no la pinta, solo reparte hacia acá (ver app/page.tsx). Existe como ruta
 * propia para poder enlazarla directo (ej. el QR del stand), no porque
 * el flujo normal la necesite.
 *
 * Es la misma pantalla y no una variante: dos puertas distintas para el
 * mismo momento es exactamente el "un estado, un nombre" que el sistema
 * prohíbe (docs/design-system.md §9). Antes acá vivía `AuthFlow`, que
 * pedía una wallet antes de preguntar a qué venías.
 *
 * **Es el único login del producto.** Existía además `/negocios/login`,
 * que daba por sentado que quien llegaba era una empresa: dos entradas
 * para el mismo acto, y solo una de las dos era la salida al cerrar
 * sesión, así que el mismo botón te dejaba en pantallas distintas según
 * de qué lado vinieras. Se borró. `/negocios` es la página de venta y su
 * llamada a la acción entra por acá como todo el mundo.
 */
export default function LoginPage() {
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!session) return;
    // Respeta el rol ya elegido: mandar a `/` a una wallet de empresa
    // solo la haría rebotar de vuelta a /solicitar.
    if (session.role === null) router.replace("/rol");
    else router.replace(homeFor(session.role));
  }, [session, router]);

  if (session === undefined || session) return <FullScreenLoader />;

  return <StandGate />;
}
