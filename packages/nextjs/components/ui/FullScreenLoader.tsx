import { WaitingScreen } from "@/components/ui/Waiting";

/**
 * Pantalla de espera mientras se resuelve la sesión o se redirige. Existe
 * como pieza propia porque ahora hay cuatro rutas que gatean por sesión y
 * cada una tenía su propio spinner suelto. El spinner se fue: la espera la
 * dice una regla que barre (ver components/ui/Waiting.tsx).
 */
export function FullScreenLoader() {
  return <WaitingScreen label="Cargando tu sesión" />;
}
