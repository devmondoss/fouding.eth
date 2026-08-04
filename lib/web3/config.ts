import { http, createConfig } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * Arbitrum Sepolia únicamente por ahora — es donde vive el CreditVault
 * mientras se desarrolla (ver hackathon.md §Bloque 0). Agregar Arbitrum
 * One acá cuando haya contratos verificados en mainnet.
 *
 * RPC configurable por env porque el endpoint público se satura rápido
 * bajo uso real; NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL es opcional.
 */
export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia],
  connectors: [injected()],
  transports: {
    [arbitrumSepolia.id]: http(
      process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL,
    ),
  },
});

export { arbitrumSepolia };
