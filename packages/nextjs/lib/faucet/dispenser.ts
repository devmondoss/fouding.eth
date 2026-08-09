import "server-only";

import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  keccak256,
  parseEther,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { arbitrumNitro } from "@/utils/scaffold-stylus/supportedChains";
import deployedContracts from "@/contracts/deployedContracts";
import { sql } from "@/lib/db/client";
import {
  TOPUP_COOLDOWN_MINUTES,
  TOPUP_DAILY_LIMIT,
  TOPUP_GAS_ETH,
  TOPUP_GAS_THRESHOLD_ETH,
  TOPUP_TOKEN_AMOUNT,
  TOPUP_TOKEN_THRESHOLD,
  type TopUpResult,
  type TopUpStatus,
} from "./config";

/**
 * Dispensadora de saldo de prueba.
 *
 * La wallet embebida de Privy nace vacía y sin gas, así que hasta ahora
 * el primer contacto con el producto terminaba en una pantalla que decía
 * "manda USDC a esta dirección" — es decir, en nada. Esto gotea las dos
 * cosas desde una cuenta operadora: gas de Arbitrum Sepolia para poder
 * firmar, y mUSDC para poder invertir.
 *
 * Lo hace el SERVIDOR y no el cliente por una razón dura: sin gas no hay
 * firma posible, así que una wallet nueva no puede llamar `faucet()` por
 * su cuenta ni aunque el contrato lo permita. El huevo antes que la
 * gallina.
 *
 * Preferimos `mint(to, amount)` sobre `transfer`: no obliga a mantener
 * un stock de tokens en la cuenta operadora. Si la cuenta no tiene
 * MINTER_ROLE, cae a transferir de su propio saldo.
 */

const MINTER_ROLE = keccak256(toBytes("MINTER_ROLE"));
/** Ninguna espera es infinita: un RPC que no responde no puede dejar la
 * petición colgada, porque del otro lado hay una pantalla esperando. */
const RECEIPT_TIMEOUT_MS = 60_000;
const DECIMALS = 1_000_000n; // MockUSDC usa 6

const tokenAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "hasRole",
    stateMutability: "view",
    inputs: [{ type: "bytes32" }, { type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "faucetClaimed",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "bool" }],
  },
] as const;

class FaucetUnavailable extends Error {}

/** La configuración no cambia entre peticiones: llave, red, RPC y token
 * salen del entorno. Se resolvía seis veces por request —creando seis
 * pares de clientes viem— y eso, sumado a lecturas en serie, es lo que
 * hacía que la pantalla de arranque tardara una eternidad. */
let cached: ReturnType<typeof buildConfiguration> | null = null;

function configuration() {
  if (!cached) cached = buildConfiguration();
  return cached;
}

function buildConfiguration() {
  // Llave propia para la dispensadora, con caída a las que ya existen:
  // en un entorno de prueba suele ser la misma cuenta operadora, y
  // obligar a duplicarla en el .env solo produce errores de copia.
  const privateKey = (process.env.FAUCET_OPERATOR_PRIVATE_KEY ||
    process.env.SERVICER_OPERATOR_PRIVATE_KEY ||
    process.env.PASSPORT_OPERATOR_PRIVATE_KEY) as Hex | undefined;

  if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new FaucetUnavailable(
      "La recarga automática no está configurada en este entorno",
    );
  }

  const chain =
    process.env.PROTOCOL_CHAIN_ID === String(arbitrumSepolia.id)
      ? arbitrumSepolia
      : arbitrumNitro;
  const rpcUrl =
    chain.id === arbitrumSepolia.id
      ? process.env.ARBITRUM_SEPOLIA_RPC_URL
      : (process.env.NITRO_RPC_URL ?? "http://localhost:8547");
  if (!rpcUrl) throw new FaucetUnavailable("Falta el RPC del protocolo");

  const contracts = deployedContracts as unknown as Record<
    string,
    Record<string, { address: Address }> | undefined
  >;
  const token = contracts[String(chain.id)]?.MockUSDC;
  if (!token) {
    throw new FaucetUnavailable(
      `No hay token de prueba desplegado en la red ${chain.id}`,
    );
  }

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  return { account, chain, publicClient, walletClient, token: token.address };
}

async function readBalances(wallet: Address) {
  const { publicClient, token } = configuration();
  const [eth, tokenBalance] = await Promise.all([
    publicClient.getBalance({ address: wallet }),
    publicClient.readContract({
      address: token,
      abi: tokenAbi,
      functionName: "balanceOf",
      args: [wallet],
    }),
  ]);
  return { eth, tokenBalance };
}

/** Cuántas recargas se entregaron hoy y cuándo fue la última de esta wallet.
 *
 * Cuenta wallets distintas, no filas: una misma recarga puede escribir
 * dos (el gas y el token se registran por separado, ver `dispense`), y
 * el tope diario habla de personas atendidas, no de transacciones. */
async function quota(wallet: string) {
  const rows = (await sql`
    SELECT
      (SELECT count(DISTINCT lower(wallet)) FROM faucet_drips WHERE created_at > now() - interval '24 hours') AS today,
      (SELECT max(created_at) FROM faucet_drips WHERE lower(wallet) = lower(${wallet})) AS last_at
  `) as Array<{ today: string; last_at: string | null }>;

  const today = Number(rows[0]?.today ?? 0);
  const lastAt = rows[0]?.last_at ? new Date(rows[0].last_at) : null;
  const waitMs = lastAt
    ? lastAt.getTime() + TOPUP_COOLDOWN_MINUTES * 60_000 - Date.now()
    : 0;

  return { today, minutesLeft: Math.max(0, Math.ceil(waitMs / 60_000)) };
}

/**
 * ¿Puede la dispensadora entregar tokens? Con MINTER_ROLE, siempre; sin
 * él, solo mientras le quede saldo propio. Se pregunta ANTES de ofrecer
 * la recarga en pantalla: prometer 25 000 mUSDC y fallar al apretar el
 * botón es peor que no ofrecerlo.
 */
async function canDeliverToken() {
  const { publicClient, account, token } = configuration();
  const [canMint, balance] = await Promise.all([
    publicClient.readContract({
      address: token,
      abi: tokenAbi,
      functionName: "hasRole",
      args: [MINTER_ROLE, account.address],
    }),
    publicClient.readContract({
      address: token,
      abi: tokenAbi,
      functionName: "balanceOf",
      args: [account.address],
    }),
  ]);
  return canMint || balance >= BigInt(TOPUP_TOKEN_AMOUNT) * DECIMALS;
}

/**
 * La otra puerta al token: `faucet()` del MockUSDC es público y entrega
 * `FAUCET_AMOUNT` una vez por dirección. No lo puede usar una wallet
 * recién creada porque no tiene gas para firmar — pero sí puede en
 * cuanto la dispensadora le manda el gas, y entonces el token sale del
 * contrato y no del bolsillo del operador.
 *
 * Esto es lo que hace que la recarga funcione sin MINTER_ROLE: el
 * servidor resuelve el problema del huevo (gas), el contrato pone la
 * gallina (token).
 */
async function canSelfClaim(wallet: Address) {
  const { publicClient, token } = configuration();
  const claimed = await publicClient.readContract({
    address: token,
    abi: tokenAbi,
    functionName: "faucetClaimed",
    args: [wallet],
  });
  return !claimed;
}

export async function getTopUpStatus(wallet?: string): Promise<TopUpStatus> {
  const base = {
    symbol: "mUSDC",
    tokenAmount: TOPUP_TOKEN_AMOUNT,
    gasEth: TOPUP_GAS_ETH,
  };

  try {
    const { publicClient, account } = configuration();

    // Las dos comprobaciones del operador, juntas.
    const [operatorEth, operatorCanEmit] = await Promise.all([
      publicClient.getBalance({ address: account.address }),
      canDeliverToken(),
    ]);

    // Una dispensadora sin gas propio no puede dispensar nada: mejor
    // decirlo acá que dejar que la transacción falle con un error de RPC.
    if (operatorEth < parseEther(TOPUP_GAS_ETH)) {
      return {
        ...base,
        available: false,
        reason: "La cuenta que reparte saldo de prueba se quedó sin gas",
      };
    }

    // Sin wallet la respuesta es genérica: si la dispensadora no puede
    // emitir, todavía queda el auto-reclamo, que depende de CADA wallet.
    if (!wallet) return { ...base, available: true };

    const address = wallet as Address;
    // En paralelo: son lecturas independientes contra el mismo RPC y
    // encadenarlas multiplicaba la latencia por cuatro.
    const [selfClaimable, balances] = await Promise.all([
      canSelfClaim(address),
      readBalances(address),
    ]);

    if (!operatorCanEmit && !selfClaimable) {
      return {
        ...base,
        available: false,
        reason:
          "La cuenta que reparte saldo de prueba no puede emitir más token, y esta wallet ya reclamó el suyo",
      };
    }

    const { eth, tokenBalance } = balances;
    const needsToken = tokenBalance < BigInt(TOPUP_TOKEN_THRESHOLD) * DECIMALS;
    const needsGas = eth < parseEther(TOPUP_GAS_THRESHOLD_ETH);

    return {
      ...base,
      available: true,
      balance: { token: Number(tokenBalance / DECIMALS), eth: formatEther(eth) },
      needsTopUp: needsToken || needsGas,
    };
  } catch (cause) {
    return {
      ...base,
      available: false,
      reason:
        cause instanceof FaucetUnavailable
          ? cause.message
          : "La recarga de prueba no está disponible ahora",
    };
  }
}

/**
 * Gotea lo que falte. Es idempotente en el sentido que importa: si la
 * wallet ya tiene saldo y gas, no manda nada y lo dice — llamarla de más
 * (por ejemplo desde el auto-recarga al entrar) no cuesta ni una
 * transacción.
 */
export async function dispense(wallet: string): Promise<TopUpResult> {
  const { publicClient, walletClient, account, token } = configuration();
  const address = wallet as Address;

  const { eth, tokenBalance } = await readBalances(address);
  const needsToken = tokenBalance < BigInt(TOPUP_TOKEN_THRESHOLD) * DECIMALS;
  const needsGas = eth < parseEther(TOPUP_GAS_THRESHOLD_ETH);

  if (!needsToken && !needsGas) {
    return {
      granted: { token: false, gas: false },
      txHashes: {},
      balance: { token: Number(tokenBalance / DECIMALS), eth: formatEther(eth) },
      message: "Tu wallet ya tiene saldo de prueba",
    };
  }

  const { today, minutesLeft } = await quota(wallet);
  if (today >= TOPUP_DAILY_LIMIT) {
    throw new FaucetUnavailable(
      "La dispensadora llegó a su tope diario. Vuelve mañana o pide saldo al equipo",
    );
  }
  if (minutesLeft > 0) {
    throw new FaucetUnavailable(
      `Ya recargaste hace poco: espera ${minutesLeft} minuto${minutesLeft === 1 ? "" : "s"}`,
    );
  }

  const txHashes: TopUpResult["txHashes"] = {};

  // El gas va primero: es lo que habilita a la wallet a hacer cualquier
  // cosa después, incluso si el token fallara.
  //
  // Y se registra ANTES de seguir: si el token falla después, ese ETH ya
  // salió de la cuenta operadora. Registrarlo recién al final dejaba el
  // goteo sin enfriamiento, y un reintento —automático, en cada carga de
  // página— volvía a mandar gas. Así se desangra una cuenta.
  if (needsGas) {
    const hash = await walletClient.sendTransaction({
      to: address,
      value: parseEther(TOPUP_GAS_ETH),
    });
    await publicClient.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS });
    txHashes.gas = hash;
    await sql`
      INSERT INTO faucet_drips (wallet, gas_wei, gas_tx_hash)
      VALUES (${wallet}, ${parseEther(TOPUP_GAS_ETH).toString()}, ${hash})
    `;
  }

  let selfClaim = false;

  if (needsToken) {
    const amount = BigInt(TOPUP_TOKEN_AMOUNT) * DECIMALS;
    const canMint = await publicClient.readContract({
      address: token,
      abi: tokenAbi,
      functionName: "hasRole",
      args: [MINTER_ROLE, account.address],
    });

    // Sin MINTER_ROLE se reparte del propio saldo; si tampoco alcanza,
    // queda el auto-reclamo contra el contrato, que la wallet ya puede
    // firmar porque el gas viajó unas líneas más arriba.
    let operatorCanPay = canMint;
    if (!canMint) {
      const operatorBalance = await publicClient.readContract({
        address: token,
        abi: tokenAbi,
        functionName: "balanceOf",
        args: [account.address],
      });
      operatorCanPay = operatorBalance >= amount;
    }

    if (operatorCanPay) {
      const hash = await walletClient.writeContract({
        address: token,
        abi: tokenAbi,
        functionName: canMint ? "mint" : "transfer",
        args: [address, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS });
      txHashes.token = hash;
    } else if (await canSelfClaim(address)) {
      selfClaim = true;
    } else {
      throw new FaucetUnavailable(
        "La cuenta que reparte saldo de prueba se quedó sin fondos y esta wallet ya reclamó el suyo",
      );
    }
  }

  if (txHashes.token) {
    await sql`
      INSERT INTO faucet_drips (wallet, token_amount, token_tx_hash)
      VALUES (${wallet}, ${String(TOPUP_TOKEN_AMOUNT)}, ${txHashes.token})
    `;
  }

  const after = await readBalances(address);

  return {
    granted: { token: Boolean(txHashes.token), gas: needsGas },
    txHashes,
    selfClaim,
    balance: {
      token: Number(after.tokenBalance / DECIMALS),
      eth: formatEther(after.eth),
    },
    message: selfClaim
      ? "Gas listo — reclamando tu saldo de prueba"
      : txHashes.token
        ? `Listo: ${TOPUP_TOKEN_AMOUNT.toLocaleString("es-PE")} mUSDC de prueba en tu wallet`
        : "Listo: gas cargado para firmar",
  };
}

export { FaucetUnavailable };
