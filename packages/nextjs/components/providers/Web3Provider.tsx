"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import {
  arbitrumNitro,
  arbitrumSepolia,
  protocolChain,
  wagmiConfig,
} from "@/lib/web3/config";

/**
 * PrivyProvider VA AFUERA de WagmiProvider — el conector de
 * @privy-io/wagmi lee del contexto de Privy, así que si el orden se
 * invierte, wagmi no encuentra la wallet embebida.
 *
 * `embeddedWallets.ethereum.createOnLogin: "all-users"` es la pieza que cumple
 * la promesa de "wallet instantánea, cero fricción": cualquiera que
 * entre (aunque sea con login invitado/anónimo si está habilitado en
 * el dashboard) se lleva una wallet real creada en el momento, sin
 * pantalla de un tercero — ver la conversación de arquitectura,
 * agosto 2026, sobre por qué Coinbase Smart Wallet no servía para esto.
 */
export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // @privy-io/wagmi's WagmiProvider necesita el contexto de PrivyProvider
  // para existir SIEMPRE, aunque no haya App ID todavía — por eso no hay
  // rama alternativa sin <PrivyProvider>. Sin App ID real, login() va a
  // fallar al llamarlo, pero la app no se rompe con eso.
  if (!appId && process.env.NODE_ENV !== "production") {
    console.warn(
      "Falta NEXT_PUBLIC_PRIVY_APP_ID en .env.local — sacá el App ID en " +
        "dashboard.privy.io y pegalo ahí. La conexión de wallet no va a " +
        "funcionar sin esto.",
    );
  }

  return (
    <PrivyProvider
      appId={appId || "not-configured"}
      config={{
        // Solo correo — nada de "Continue with a wallet" ni el resto de
        // opciones que trae Privy por defecto. Un paso, rápido.
        loginMethods: ["email"],
        appearance: {
          theme: "light",
          // El lima de marca (BRAND) es fill-only por diseño (ver
          // lib/brandColors.ts) — Privy lo usa como color de TEXTO/borde
          // en botones como "Submit", donde queda casi invisible sobre
          // blanco. Negro sólido en vez de un tono de marca: cero
          // ambigüedad de contraste.
          accentColor: "#000000",
        },
        embeddedWallets: {
          ethereum: { createOnLogin: "all-users" },
        },
        defaultChain: protocolChain,
        supportedChains: [arbitrumNitro, arbitrumSepolia],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
