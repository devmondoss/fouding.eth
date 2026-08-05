import { BusinessLanding } from "@/components/flow/BusinessLanding";

/**
 * Casa permanente de la propuesta para empresas. Es pública y estática:
 * no depende de sesión ni de localStorage, así que siempre se puede
 * volver a leer — a diferencia del interstitial que reemplaza, que se
 * mostraba una vez y después reaparecía encima de la app.
 */
export const metadata = {
  title: "Founding para empresas — financia tu próxima etapa",
  description:
    "Publica tu proyecto, sube tu expediente legal y conecta con inversionistas que respaldan operaciones con garantía real, en USDC sobre Arbitrum.",
};

export default function NegociosPage() {
  return <BusinessLanding />;
}
