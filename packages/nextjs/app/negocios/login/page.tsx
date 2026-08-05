import { BusinessLoginScreen } from "@/components/flow/BusinessLoginScreen";

export const metadata = {
  title: "Entrar — Founding para empresas",
  description:
    "Crea tu cuenta con tu correo. Te generamos la wallet al instante para recibir el capital si tu expediente es aprobado.",
};

export default function NegociosLoginPage() {
  return <BusinessLoginScreen />;
}
