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
          /**
           * Sin los modales de Privy. La confirmación es del producto.
           *
           * Privy interponía su propia pantalla antes de cada firma:
           * "Approve transaction — fondealo.eth wants your permission to
           * approve the following transaction", con la dirección del
           * contrato en hexadecimal, "Network", "Estimated fee" y un
           * botón "Approve". Tres problemas, y el idioma es el menor:
           *
           *   1. **Es una segunda confirmación.** InvestPanel ya abre la
           *      suya con monto, rentabilidad, plazo, calificación,
           *      cobertura, ganancia estimada y el riesgo de liquidez.
           *      Quien aprieta "Confirmar 10 000 USDC" ya decidió; volver
           *      a preguntárselo con otras palabras no agrega consenso,
           *      agrega duda.
           *   2. **No se entiende.** Un dueño de PyME en un stand no sabe
           *      qué es aprobar una transacción a `0xe1a2…3684`. El dato
           *      que necesita —cuánto pone y qué recibe— ya lo vio; este
           *      lo reemplaza por uno que no puede evaluar.
           *   3. **Está en inglés y no se puede traducir.** Privy 3.36.1
           *      no expone ninguna opción de idioma: `appearance` solo
           *      admite tema y color de acento. La única forma de que
           *      este paso hable castellano es que sea nuestro.
           *
           * Lo que se pierde —el desglose de comisión y el "estás
           * autorizando a X a gastar Y"— lo asume InvestPanel, que
           * nombra los dos pasos mientras corren.
           *
           * La wallet firma sin preguntar, y eso está bien acá porque el
           * producto ya preguntó. Si algún día una firma NO tuviera una
           * confirmación propia delante, esta línea deja de ser
           * defendible: la regla es "toda acción irreversible se
           * confirma" (docs/design-system.md §9), no "se confirma en
           * algún lado".
           */
          showWalletUIs: false,
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
