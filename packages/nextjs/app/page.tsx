"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { homeFor } from "@/lib/routes";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import { useSession } from "@/lib/useSession";

/**
 * La raíz no es una pantalla: es un repartidor.
 *
 * Era el módulo del inversionista, y por eso el catálogo vivía en una URL
 * que no lo nombraba. Las otras dos superficies sí tienen nombre
 * —`/solicitar` para la empresa, `/verifier` para el operador— así que la
 * del inversionista era la única que dependía de la raíz para existir. La
 * regla del proyecto no admite esa excepción: la barra de direcciones
 * tiene que decir lo que la pantalla está haciendo, y `/` no dice nada.
 *
 * Ahora el catálogo vive en `/oportunidades`, que es literalmente su
 * titular, y acá solo queda el reparto — que es lo que la raíz de
 * verdad hace bien y lo único que no puede vivir en otro lado:
 *
 *   sin sesión      → /login       la puerta
 *   sin rol         → /rol         elegir lado (una vez por wallet)
 *   inversionista   → /oportunidades
 *   empresa         → /solicitar
 *
 * Esto también es lo que hace que el QR del stand pueda apuntar al
 * dominio pelado y funcione para cualquiera: quien llega por primera vez
 * y quien vuelve con sesión terminan cada uno donde les toca, sin que el
 * cartel tenga que saber de rutas.
 */
export default function RootDispatch() {
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session === undefined) return; // Privy todavía resolviendo
    if (session === null) {
      router.replace("/login");
      return;
    }
    router.replace(session.role === null ? "/rol" : homeFor(session.role));
  }, [session, router]);

  return <FullScreenLoader />;
}
