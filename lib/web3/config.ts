import { http, createConfig } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { coinbaseWallet } from "wagmi/connectors";

/**
 * Arbitrum Sepolia únicamente por ahora — es donde vive el CreditVault
 * mientras se desarrolla (ver hackathon.md §Bloque 0). Agregar Arbitrum
 * One acá cuando haya contratos verificados en mainnet.
 *
 * Conector: Coinbase Smart Wallet, no "injected". `smartWalletOnly`
 * fuerza el flujo de passkey (huella/Face ID) y crea la wallet al
 * instante — no requiere que el usuario tenga MetaMask ni ninguna
 * extensión instalada de antemano. Es lo que cumple la promesa
 * original de "wallet instantánea, sin fricción" (ver design-system.md
 * §6 y el comentario de AuthFlow.tsx). Gratis, sin cuenta ni API key.
 *
 * RPC configurable por env porque el endpoint público se satura rápido
 * bajo uso real; NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL es opcional.
 */
export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia],
  connectors: [
    coinbaseWallet({
      appName: "Founding",
      preference: { options: "smartWalletOnly" },
    }),
  ],
  transports: {
    [arbitrumSepolia.id]: http(
      process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL,
    ),
  },
});

export { arbitrumSepolia };
