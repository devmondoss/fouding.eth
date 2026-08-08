import { Address, createPublicClient, createWalletClient, http, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import deployStylusContract from "./deploy_contract";
import { getDeploymentConfig, getRpcUrlFromChain } from "./utils/";
import { getContractData } from "./utils/contract";
import type { DeployOptions } from "./utils/type";

const ARBITRUM_SEPOLIA_USDC_ADDRESS =
  "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as Address;

/**
 * Standalone incremental deploy: RepaymentRouter to an already-deployed
 * Sepolia protocol. Deploys the contract, then does the three steps that
 * make it usable — initialize(token), get SERVICER_ROLE on CreditRegistry
 * (it becomes msg.sender against CreditVault.record_repayment, same as any
 * other servicer account), and approve the deployed CreditVault. Without
 * these three the router exists on-chain but every call reverts.
 */
async function main() {
  const options: DeployOptions = {
    network: "arbitrumSepolia",
    contract: "repayment-router",
    name: "RepaymentRouter",
    constructorArgs: [],
    isOrbit: false,
    verify: false,
    estimateGas: false,
  };

  await deployStylusContract(options);

  const config = getDeploymentConfig(options);
  const chainId = config.chain.id.toString();
  const router = getContractData(chainId, "RepaymentRouter");
  const registry = getContractData(chainId, "CreditRegistry");
  const vault = getContractData(chainId, "CreditVault");

  const rpcUrl = getRpcUrlFromChain(config.chain);
  const account = privateKeyToAccount(config.privateKey as `0x${string}`);
  const publicClient = createPublicClient({ chain: config.chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: config.chain, transport: http(rpcUrl) });

  async function send(label: string, args: Parameters<typeof publicClient.simulateContract>[0]) {
    const { request } = await publicClient.simulateContract(args);
    const hash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`${label} reverted: ${hash}`);
    console.log(`✅ ${label}: ${hash}`);
  }

  await send("RepaymentRouter.initialize", {
    account,
    address: router.address as Address,
    abi: router.abi,
    functionName: "initialize",
    args: [ARBITRUM_SEPOLIA_USDC_ADDRESS],
  });

  const servicerRole = keccak256(toBytes("SERVICER_ROLE"));
  await send("Registry.grantRole(SERVICER_ROLE, RepaymentRouter)", {
    account,
    address: registry.address as Address,
    abi: registry.abi,
    functionName: "grantRole",
    args: [servicerRole, router.address],
  });

  await send("RepaymentRouter.setVaultApproved(CreditVault)", {
    account,
    address: router.address as Address,
    abi: router.abi,
    functionName: "setVaultApproved",
    args: [vault.address, true],
  });

  console.log(`\n📦 RepaymentRouter ready at ${router.address}`);
}

main().catch((e: unknown) => {
  console.error("FATAL", e);
  process.exit(1);
});
