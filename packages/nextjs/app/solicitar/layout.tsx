/**
 * Existe solo para el título: la metadata del layout raíz es del lado
 * inversionista ("invierte en empresas que ya facturan"), y esa pestaña
 * en el panel de una empresa decía justo lo contrario de lo que la
 * persona está haciendo (ver conversación de agosto 2026).
 */
export const metadata = {
  title: "Tus solicitudes — Árbitro para empresas",
  description:
    "Estado de los expedientes que enviaste a revisión y envío de nuevas solicitudes de financiamiento.",
};

export default function SolicitarLayout({ children }: LayoutProps<"/solicitar">) {
  return children;
}
