import {
  createPublicClient,
  formatEther,
  http,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import deployedContracts from "../contracts/deployedContracts";
import { TOPUP_GAS_ETH, TOPUP_TOKEN_AMOUNT } from "../lib/faucet/config";

/**
 * Diagnóstico de la dispensadora de saldo de prueba: responde, en un
 * comando, si la recarga automática va a funcionar y qué falta si no.
 *
 * Existe porque el modo de falla es silencioso desde afuera —la app solo
 * dice "no disponible"— y las tres causas posibles (sin llave, sin gas,
 * sin poder emitir el token) se arreglan de formas muy distintas.
 *
 *   yarn faucet:check
 */

const tokenAbi = [
  {
    type: "function",
    name: "hasRole",
    stateMutability: "view",
    inputs: [{ type: "bytes32" }, { type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const MINTER_ROLE = keccak256(toBytes("MINTER_ROLE"));

async function main() {
  const privateKey = (process.env.FAUCET_OPERATOR_PRIVATE_KEY ||
    process.env.SERVICER_OPERATOR_PRIVATE_KEY ||
    process.env.PASSPORT_OPERATOR_PRIVATE_KEY) as Hex | undefined;

  if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    console.log("✖ Falta FAUCET_OPERATOR_PRIVATE_KEY en .env.local");
    process.exit(1);
  }

  const chainId = Number(process.env.PROTOCOL_CHAIN_ID ?? arbitrumSepolia.id);
  const rpcUrl =
    chainId === arbitrumSepolia.id
      ? process.env.ARBITRUM_SEPOLIA_RPC_URL
      : (process.env.NITRO_RPC_URL ?? "http://localhost:8547");

  const contracts = deployedContracts as unknown as Record<
    string,
    Record<string, { address: Address }> | undefined
  >;
  const token = contracts[String(chainId)]?.MockUSDC;
  if (!token) {
    console.log(`✖ No hay MockUSDC desplegado en la red ${chainId}`);
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey);
  const client = createPublicClient({ transport: http(rpcUrl) });

  const [eth, canMint, balance] = await Promise.all([
    client.getBalance({ address: account.address }),
    client.readContract({
      address: token.address,
      abi: tokenAbi,
      functionName: "hasRole",
      args: [MINTER_ROLE, account.address],
    }),
    client.readContract({
      address: token.address,
      abi: tokenAbi,
      functionName: "balanceOf",
      args: [account.address],
    }),
  ]);

  const tokens = Number(balance) / 1e6;
  // El gas es el techo real de la jornada: cuántos visitantes se pueden
  // atender antes de que la cuenta operadora quede seca.
  const visitantes = Math.floor(Number(formatEther(eth)) / Number(TOPUP_GAS_ETH));

  console.log(`Red        ${chainId}`);
  console.log(`Token      ${token.address}`);
  console.log(`Operador   ${account.address}`);
  console.log(`Gas        ${formatEther(eth)} ETH → alcanza para ~${visitantes} wallets`);
  console.log(`MINTER     ${canMint ? "sí — emisión ilimitada" : "no"}`);
  console.log(`Saldo      ${tokens.toLocaleString("es-PE")} mUSDC`);

  if (canMint) {
    console.log("\n✓ Lista: la dispensadora mintea el token directamente.");
  } else if (tokens >= TOPUP_TOKEN_AMOUNT) {
    console.log(
      `\n✓ Lista: reparte de su propio saldo, le alcanza para ~${Math.floor(tokens / TOPUP_TOKEN_AMOUNT)} recarga(s),` +
        ` y después cae al auto-reclamo.`,
    );
  } else {
    // Sin rol ni saldo NO está apagada: el MockUSDC tiene `faucet()`
    // público, y la wallet del visitante puede firmarlo apenas recibe el
    // gas. Decir "apagada" acá sería el diagnóstico mintiendo.
    console.log(
      `\n✓ Lista por auto-reclamo: la dispensadora manda el gas y cada wallet nueva` +
        `\n  reclama sus ${TOPUP_TOKEN_AMOUNT.toLocaleString("es-PE")} mUSDC del contrato (una vez por dirección).`,
    );
    console.log(
      `\n  Opcional — para emitir sin límite y cubrir wallets que ya reclamaron,` +
        `\n  desde la wallet admin de MockUSDC:` +
        `\n    grantRole(${MINTER_ROLE}, ${account.address})` +
        `\n    en el contrato ${token.address}`,
    );
  }

  if (visitantes < 20) {
    console.log(
      `\n⚠ Queda poco gas: recarga ${account.address} desde un faucet de Arbitrum Sepolia.`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
