"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RoleGate } from "@/components/flow/RoleGate";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import { homeFor } from "@/lib/routes";
import { useSession } from "@/lib/useSession";

/**
 * Pantalla de /rol — el paso "¿inversionista o dueño de negocio?" con URL
 * propia, en vez de aparecer incrustado dentro de / o /solicitar. Es la
 * misma regla que el login de empresa: la barra de direcciones tiene que
 * decir lo que la pantalla está haciendo.
 *
 * Solo tiene sentido con sesión y sin rol: cualquier otro caso se
 * redirige, así nadie llega acá a elegir algo que ya eligió.
 */
export function RoleGateScreen() {
  const { session, chooseRole, signOut } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) router.replace("/login");
    else if (session.role !== null) router.replace(homeFor(session.role));
  }, [session, router]);

  if (session === undefined || session === null || session.role !== null) {
    return <FullScreenLoader />;
  }

  return (
    <RoleGate
      onChoose={(role) => {
        chooseRole(role);
        router.replace(homeFor(role));
      }}
      onSignOut={signOut}
    />
  );
}
