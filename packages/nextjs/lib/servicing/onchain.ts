import "server-only";

import { randomUUID } from "node:crypto";
import { keccak256, toHex, type Address, type Hex } from "viem";
import {
  getDeployment,
  getPublicClient,
  getSigner,
  resolveChain,
  writeAndWait,
  type Deployment,
} from "../protocolServer";
import { getProtocolToken } from "../web3/protocol";

/**
 * Administración del crédito: activar el desembolso, registrar repagos,
 * declarar el incumplimiento y ejecutar el recupero.
 *
 * El CreditVault implementa todo esto y estaba probado, pero solo se
 * alcanzaba desde packages/stylus/scripts/protocol_e2e.ts — o sea que el
 * camino de default, que es el diferenciador del pitch (docs/checklist.md
 * §Presentación), no se podía mostrar en una demo.
 *
 * Firma desde el servidor por la misma razón que compliance: los roles
 * SERVICER/ORIGINATOR viven en cuentas de operación, no en la wallet de
 * quien abre el panel.
 */

const KEYS = ["SERVICER_OPERATOR_PRIVATE_KEY", "PASSPORT_OPERATOR_PRIVATE_KEY"];

export const STATUS_LABEL: Record<number, string> = {
  0: "Borrador",
  1: "En recaudación",
  2: "Fondeada",
  3: "Activa",
  4: "Pagada",
  5: "En incumplimiento",
  6: "En recupero",
  7: "Cerrada",
  8: "Cancelada",
};

export type VaultAction =
  | "openFunding"
  | "activate"
  | "recordRepayment"
  | "declareDefault"
  | "startRecovery"
  | "recordRecovery"
  | "close";

/**
 * Qué transiciones admite cada estado. Sale de los `require_state` del
 * contrato: ofrecer una acción imposible solo produce un revert con un
 * mensaje que nadie entiende.
 */
export const ACTIONS_BY_STATUS: Record<number, VaultAction[]> = {
  0: ["openFunding"],
  1: [],
  2: ["activate"],
  3: ["recordRepayment", "declareDefault"],
  4: ["close"],
  5: ["startRecovery", "close"],
  6: ["recordRecovery", "close"],
  7: [],
  8: ["close"],
};

/** Acciones que mueven dinero DESDE el operador hacia el vault. */
const PULLS_FUNDS: VaultAction[] = ["recordRepayment", "recordRecovery"];

/**
 * `recordRepayment` se enruta por `RepaymentRouter` cuando está desplegado
 * en esta chain — dedup por repaymentId y traza auditable
 * (packages/stylus/contracts/repayment-router). Si todavía no se
 * redesplegó (ver docs/pendientes.md), cae al llamado directo al vault que
 * ya existía, para no romper una demo en curso.
 */
function getRepaymentRouter(): Deployment | null {
  try {
    return getDeployment("RepaymentRouter");
  } catch {
    return null;
  }
}

export type VaultState = {
  address: Address;
  status: number;
  statusLabel: string;
  totalFunded: string;
  principalOutstanding: string;
  totalRepaid: string;
  totalClaimable: string;
  totalClaimed: string;
  available: VaultAction[];
};

export async function getVaultState(): Promise<VaultState> {
  const vault = getDeployment("CreditVault");
  const client = getPublicClient();

  const [status, accounting] = await Promise.all([
    client.readContract({
      address: vault.address,
      abi: vault.abi,
      functionName: "status",
    } as never) as Promise<number>,
    client.readContract({
      address: vault.address,
      abi: vault.abi,
      functionName: "getAccounting",
    } as never) as Promise<readonly [bigint, bigint, bigint, bigint, bigint]>,
  ]);

  const [funded, outstanding, repaid, claimable, claimed] = accounting;
  return {
    address: vault.address,
    status: Number(status),
    statusLabel: STATUS_LABEL[Number(status)] ?? `Estado ${status}`,
    totalFunded: funded.toString(),
    principalOutstanding: outstanding.toString(),
    totalRepaid: repaid.toString(),
    totalClaimable: claimable.toString(),
    totalClaimed: claimed.toString(),
    available: ACTIONS_BY_STATUS[Number(status)] ?? [],
  };
}

export async function runVaultAction(
  action: VaultAction,
  amount?: bigint,
  breakdown?: { principal: bigint; interest: bigint },
): Promise<Hex> {
  const vault = getDeployment("CreditVault");
  const signer = getSigner(KEYS);
  const router = action === "recordRepayment" ? getRepaymentRouter() : null;
  // Spender del approve: el router intermedia custodia antes de llamar al
  // vault (packages/stylus/contracts/repayment-router), así que el
  // allowance tiene que apuntar ahí y no al vault directo cuando existe.
  const spender = router?.address ?? vault.address;

  if (PULLS_FUNDS.includes(action)) {
    if (!amount || amount <= 0n) {
      throw new Error("El monto debe ser mayor que cero");
    }
    // El operador (o el router, en su nombre) hace transferFrom sobre QUIEN
    // LLAMA, así que la cuenta que firma tiene que tener saldo y allowance
    // sobre `spender`. Sin esto la transacción revierte con un error del
    // token, no del vault, y es imposible de diagnosticar desde el panel.
    const { chain } = resolveChain();
    const token = getProtocolToken(chain.id);
    if (!token.address) {
      throw new Error(`No hay token de pago configurado para chain ${chain.id}`);
    }
    const balance = (await signer.publicClient.readContract({
      address: token.address,
      abi: token.abi,
      functionName: "balanceOf",
      args: [signer.account.address],
    } as never)) as bigint;
    if (balance < amount) {
      throw new Error(
        `El operador no tiene saldo suficiente (${balance} < ${amount}) en ${token.symbol}. La cuenta necesita saldo y allowance del token de pago.`,
      );
    }

    const allowance = (await signer.publicClient.readContract({
      address: token.address,
      abi: token.abi,
      functionName: "allowance",
      args: [signer.account.address, spender],
    } as never)) as bigint;
    if (allowance < amount) {
      await writeAndWait(signer, {
        address: token.address,
        abi: token.abi,
        functionName: "approve",
        args: [spender, amount],
      });
    }
  }

  if (action === "recordRepayment" && router) {
    const principal = breakdown?.principal ?? amount!;
    const interest = breakdown?.interest ?? 0n;
    if (principal + interest !== amount) {
      throw new Error("principal + interest debe ser igual a amount");
    }
    const repaymentId = keccak256(
      toHex(`${vault.address}:${Date.now()}:${randomUUID()}`),
    );
    return writeAndWait(signer, {
      address: router.address,
      abi: router.abi,
      functionName: "recordRepayment",
      args: [vault.address, repaymentId, amount, principal, interest],
    });
  }

  const args =
    action === "recordRepayment" || action === "recordRecovery"
      ? [amount!]
      : undefined;

  return writeAndWait(signer, {
    address: vault.address,
    abi: vault.abi,
    functionName: action,
    args,
  });
}
