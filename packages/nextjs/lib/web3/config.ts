import { http } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { createConfig } from "@privy-io/wagmi";

/**
 * Arbitrum Sepolia únicamente por ahora — es donde vive el CreditVault
 * mientras se desarrolla (ver hackathon.md §Bloque 0). Agregar Arbitrum
 * One acá cuando haya contratos verificados en mainnet.
 *
 * `createConfig` es el de @privy-io/wagmi, no el de wagmi a secas — ya
 * viene preparado para que la wallet embebida de Privy aparezca como
 * conector activo. No hace falta declarar conectores acá: Privy los
 * inyecta (ver components/providers/Web3Provider.tsx).
 *
 * RPC configurable por env porque el endpoint público se satura rápido
 * bajo uso real; NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL es opcional.
 */
export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia],
  transports: {
    [arbitrumSepolia.id]: http(
      process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL,
    ),
  },
});

export { arbitrumSepolia };
