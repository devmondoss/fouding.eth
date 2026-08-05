import { createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { arbitrumNitro } from "@/utils/scaffold-stylus/supportedChains";

/**
 * Cliente de lectura server-side (indexer, scripts). Separado del
 * wagmi config de lib/web3/config.ts porque ese es para el navegador
 * (conectores de wallet); esto es solo RPC, sin wallet.
 */
const useSepolia = process.env.PROTOCOL_CHAIN_ID === String(arbitrumSepolia.id);
const chain = useSepolia ? arbitrumSepolia : arbitrumNitro;
const rpcUrl = useSepolia
  ? process.env.ARBITRUM_SEPOLIA_RPC_URL
  : process.env.NITRO_RPC_URL ?? "http://localhost:8547";

export const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
