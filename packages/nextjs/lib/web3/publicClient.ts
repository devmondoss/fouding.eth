import { createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";

/**
 * Cliente de lectura server-side (indexer, scripts). Separado del
 * wagmi config de lib/web3/config.ts porque ese es para el navegador
 * (conectores de wallet); esto es solo RPC, sin wallet.
 */
export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(process.env.ARBITRUM_SEPOLIA_RPC_URL),
});
