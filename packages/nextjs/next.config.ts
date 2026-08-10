import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Next 16.3's CLI runner can close before collecting the complete JSON from
  // `tsc --showConfig`. TypeScript 5.9 still provides the compiler API, which
  // avoids that stdout race without skipping or weakening type checking.
  experimental: {
    useTypeScriptCli: false,
  },
  /**
   * `/negocios/login` se borró: había dos logins para el mismo acto y solo
   * uno era la salida al cerrar sesión. Borrar una ruta que estuvo viva no
   * es suficiente —queda en marcadores, en el historial y en cualquier
   * enlace que se haya compartido— así que se redirige en vez de dar 404.
   * Permanente: no va a volver.
   */
  async redirects() {
    return [
      {
        source: "/negocios/login",
        destination: "/login",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
