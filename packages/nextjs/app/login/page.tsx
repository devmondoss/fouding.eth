"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthFlow } from "@/components/flow/AuthFlow";
import { useSession } from "@/lib/useSession";

/**
 * URL directa a la pantalla de login del inversionista — el mismo
 * AuthFlow que ya se muestra automáticamente en `/` cuando no hay
 * sesión. Existe como ruta propia para poder enlazarla directo (ej.
 * desde fuera de la app), no porque el flujo normal la necesite: en
 * `/` el login sigue apareciendo solo, sin pasar por acá.
 */
export default function LoginPage() {
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace("/");
  }, [session, router]);

  if (session === undefined || session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--brand-ink)" }} />
      </div>
    );
  }

  return <AuthFlow />;
}
