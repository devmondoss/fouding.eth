import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import {
  Abi,
  Address,
  Chain,
  Hex,
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import deployStylusContract from "./deploy_contract";
import { runTestnetPreflight } from "./preflight_testnet";
import { verifySoliditySource } from "./verify_solidity_explorer";
import {
  generateTsAbi,
  getDeploymentConfig,
  getRpcUrlFromChain,
  parseAbiOutput,
  parseContractDeployment,
  printDeployedAddresses,
  saveDeployment,
  writeCleanAbiFile,
} from "./utils/";
import { DeployOptions, DeploymentConfig } from "./utils/type";
import { executeFileCommand } from "./utils/command";

type FoundryArtifact = {
  abi: Abi;
  bytecode: { object: Hex };
};

type ContractDeployment = {
  address: Address;
  txHash: Hex;
  abi: Abi;
};

const FOUNDRY_ROOT = path.resolve(__dirname, "../../foundry");
const STYLUS_WORKSPACE = path.resolve(__dirname, "../contracts");
const USDC = 10n ** 6n;
const DAY = 24n * 60n * 60n;
const ARBITRUM_SEPOLIA_USDC_ADDRESS =
  "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as Address;

function archiveLatestDeployment(deploymentDir: string, chainId: number): void {
  const latest = path.resolve(deploymentDir, `${chainId}_latest.json`);
  if (!fs.existsSync(latest)) return;
  const archive = path.resolve(
    deploymentDir,
    `${chainId}_${Date.now()}.json`,
  );
  fs.renameSync(latest, archive);
  console.log(`📦 Archived previous local deployment: ${archive}`);
}

function loadArtifact(source: string, contract: string): FoundryArtifact {
  const artifactPath = path.join(
    FOUNDRY_ROOT,
    "out",
    `${source}.sol`,
    `${contract}.json`,
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Foundry artifact not found: ${artifactPath}`);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as FoundryArtifact;
  if (!artifact.bytecode?.object?.startsWith("0x")) {
    throw new Error(`Invalid bytecode in ${artifactPath}`);
  }
  return artifact;
}

function deploymentConfig(
  base: DeploymentConfig,
  contractName: string,
  contractFolder: string,
): DeploymentConfig {
  return {
    ...base,
    contractName,
    contractFolder,
  };
}

async function deploySolidity(
  source: string,
  contractName: string,
  baseConfig: DeploymentConfig,
  walletClient: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  admin: Address,
  verify: boolean,
): Promise<ContractDeployment> {
  const artifact = loadArtifact(source, contractName);
  console.log(`\n🚀 Deploying Solidity contract: ${contractName}`);
  const txHash = await walletClient.deployContract({
    account: privateKeyToAccount(baseConfig.privateKey as Hex),
    chain: baseConfig.chain,
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    args: [admin],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`${contractName} deployment reverted: ${txHash}`);
  }

  const contractFolder = `foundry-${contractName}`;
  const config = deploymentConfig(baseConfig, contractName, contractFolder);
  saveDeployment(config, { address: receipt.contractAddress, txHash });
  writeCleanAbiFile(
    path.resolve(config.deploymentDir, contractFolder),
    Array.from(artifact.abi),
  );
  console.log(`✅ ${contractName}: ${receipt.contractAddress}`);
  if (verify) {
    verifySoliditySource({
      address: receipt.contractAddress,
      source,
      contractName,
      admin,
      chainId: baseConfig.chain.id,
      rpcUrl: getRpcUrlFromChain(baseConfig.chain),
    });
  }
  return {
    address: receipt.contractAddress,
    txHash,
    abi: artifact.abi,
  };
}

async function loadExistingDeployment(
  contractName: string,
  baseConfig: DeploymentConfig,
  publicClient: ReturnType<typeof createPublicClient>,
): Promise<ContractDeployment | null> {
  const manifestPath = path.resolve(
    baseConfig.deploymentDir,
    `${baseConfig.chain.id}_latest.json`,
  );
  if (!fs.existsSync(manifestPath)) return null;

  try {
    const manifest: unknown = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const stored = parseContractDeployment(
      manifest,
      contractName,
      String(baseConfig.chain.id),
    );
    const code = await publicClient.getBytecode({ address: stored.address });
    if (!code || code === "0x") {
      throw new Error(`${contractName} has no bytecode on chain`);
    }
    const abiPath = path.resolve(
      baseConfig.deploymentDir,
      stored.contractFolder,
    );
    if (!fs.existsSync(abiPath)) {
      throw new Error(`${contractName} ABI is missing from the deployment directory`);
    }
    console.log(`♻️ Reusing ${contractName}: ${stored.address}`);
    return {
      address: stored.address,
      txHash: stored.txHash as Hex,
      abi: parseAbiOutput(fs.readFileSync(abiPath, "utf8")) as Abi,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes(`Contract ${contractName} not found`)
    ) {
      return null;
    }
    throw error;
  }
}

async function writeAndWait(
  label: string,
  walletClient: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  request: {
    address: Address;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
    account: ReturnType<typeof privateKeyToAccount>;
    chain: Chain;
  },
): Promise<Hex> {
  const txHash = await walletClient.writeContract(request as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error(`${label} reverted: ${txHash}`);
  console.log(`✅ ${label}: ${txHash}`);
  return txHash;
}

/** Deploys and configures the complete local protocol in dependency order. */
export default async function deployScript(deployOptions: DeployOptions) {
  const options = { network: "devnet", ...deployOptions };
  if (options.network === "sepolia" || options.network === "arbitrumSepolia") {
    await runTestnetPreflight();
  }
  const baseConfig = getDeploymentConfig({
    ...options,
    contract: "credit-vault",
    name: "CreditVault",
  });
  const rpcUrl = getRpcUrlFromChain(baseConfig.chain);
  const account = privateKeyToAccount(baseConfig.privateKey as Hex);
  const publicClient = createPublicClient({
    chain: baseConfig.chain,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: baseConfig.chain,
    transport: http(rpcUrl),
  });

  console.log(`🌐 Network: ${baseConfig.chain.name} (${baseConfig.chain.id})`);
  console.log(`👤 Deployer: ${account.address}`);
  console.log(`📁 Deployment directory: ${baseConfig.deploymentDir}`);

  execFileSync("forge", ["build", "--root", FOUNDRY_ROOT], {
    stdio: "inherit",
  });

  await executeFileCommand(
    {
      executable: "cargo",
      args: [
        "stylus",
        "check",
        "--contract=credit-vault",
        `--endpoint=${rpcUrl}`,
      ],
      displayArgs: [
        "stylus",
        "check",
        "--contract=credit-vault",
        "--endpoint=***",
      ],
      cleanup: () => undefined,
    },
    STYLUS_WORKSPACE,
    "Checking CreditVault against the target Stylus runtime",
  );

  if (options.estimateGas) {
    await deployStylusContract({
      ...options,
      contract: "credit-vault",
      name: "CreditVault",
      constructorArgs: [],
    });
    return;
  }

  if (!options.resume) {
    archiveLatestDeployment(baseConfig.deploymentDir, baseConfig.chain.id);
  }

  // Payment token: MockUSDC everywhere, Sepolia included.
  //
  // Picking Circle's USDC on Sepolia looked canonical but broke the only
  // path a visitor has: that token has no faucet, so a freshly created
  // wallet could never hold any, and "invest" was unreachable without
  // bridging testnet USDC in from outside the product. The app hands out
  // MockUSDC (see lib/faucet), and a vault that expects a different token
  // than the one people actually hold is a vault nobody can fund.
  //
  // Pass --circle-usdc to go back to Circle's token on Sepolia — for a
  // deployment meant to be funded by hand rather than demoed.
  let paymentToken: Address;
  if (baseConfig.chain.id === arbitrumSepolia.id && options.circleUsdc) {
    paymentToken = ARBITRUM_SEPOLIA_USDC_ADDRESS;
    console.log(`💵 Payment token: Circle USDC (canonical) ${paymentToken}`);
  } else {
    const mockUsdc =
      (options.resume &&
        (await loadExistingDeployment("MockUSDC", baseConfig, publicClient))) ||
      (await deploySolidity(
        "MockUSDC",
        "MockUSDC",
        baseConfig,
        walletClient,
        publicClient,
        account.address,
        Boolean(options.verify),
      ));
    paymentToken = mockUsdc.address;
    console.log(`💵 Payment token: MockUSDC ${paymentToken}`);
  }
  const accessRegistry =
    (options.resume &&
      (await loadExistingDeployment("AccessRegistry", baseConfig, publicClient))) ||
    (await deploySolidity(
      "AccessRegistry",
      "AccessRegistry",
      baseConfig,
      walletClient,
      publicClient,
      account.address,
      Boolean(options.verify),
    ));
  const passport =
    (options.resume &&
      (await loadExistingDeployment("CompanyPassportSBT", baseConfig, publicClient))) ||
    (await deploySolidity(
      "CompanyPassportSBT",
      "CompanyPassportSBT",
      baseConfig,
      walletClient,
      publicClient,
      account.address,
      Boolean(options.verify),
    ));
  const registry =
    (options.resume &&
      (await loadExistingDeployment("CreditRegistry", baseConfig, publicClient))) ||
    (await deploySolidity(
      "CreditRegistry",
      "CreditRegistry",
      baseConfig,
      walletClient,
      publicClient,
      account.address,
      Boolean(options.verify),
    ));

  let mainVault =
    options.resume &&
    (await loadExistingDeployment("CreditVault", baseConfig, publicClient));
  if (!mainVault) {
    await deployStylusContract({
      ...options,
      contract: "credit-vault",
      name: "CreditVault",
      constructorArgs: [],
    });
    const deploymentModule = await import("./utils/contract");
    mainVault = deploymentModule.getContractData(
      baseConfig.chain.id.toString(),
      "CreditVault",
    ) as ContractDeployment;
  }
  if (!options.minimal) {
    await deployStylusContract({
      ...options,
      contract: "credit-vault",
      name: "CreditVaultHappy",
      constructorArgs: [],
    });
    await deployStylusContract({
      ...options,
      contract: "credit-vault",
      name: "CreditVaultRecovery",
      constructorArgs: [],
    });
  }

  const deploymentModule = await import("./utils/contract");

  await writeAndWait("Registry.setPassportContract", walletClient, publicClient, {
    account,
    chain: baseConfig.chain,
    address: registry.address,
    abi: registry.abi,
    functionName: "setPassportContract",
    args: [passport.address],
  });
  await writeAndWait("Registry.setAccessRegistryContract", walletClient, publicClient, {
    account,
    chain: baseConfig.chain,
    address: registry.address,
    abi: registry.abi,
    functionName: "setAccessRegistryContract",
    args: [accessRegistry.address],
  });
  await writeAndWait("Registry.setPaymentToken", walletClient, publicClient, {
    account,
    chain: baseConfig.chain,
    address: registry.address,
    abi: registry.abi,
    functionName: "setPaymentToken",
    args: [paymentToken, true],
  });

  const devAccounts = (
    baseConfig.chain as Chain & {
      accounts?: Array<{ address: Address; privateKey: Hex }>;
    }
  ).accounts;
  const borrower = devAccounts?.[1]?.address ?? account.address;
  const investorAccount = privateKeyToAccount(
    devAccounts?.[2]?.privateKey ?? (baseConfig.privateKey as Hex),
  );
  const investorWallet = createWalletClient({
    account: investorAccount,
    chain: baseConfig.chain,
    transport: http(rpcUrl),
  });
  const deploymentLabel =
    baseConfig.chain.id === 421614
      ? "fouding-arbitrum-sepolia-mvp-v1"
      : "fouding-local-v1";
  const legalPackHash = keccak256(toBytes(`${deploymentLabel}:legal-pack`));
  const metadataHash = keccak256(toBytes(`${deploymentLabel}:public-metadata`));
  const collateralHash = keccak256(toBytes(`${deploymentLabel}:collateral`));
  const latestBlock = await publicClient.getBlock();
  const passportExpiry = latestBlock.timestamp + 365n * DAY;

  await writeAndWait("Passport.issuePassport", walletClient, publicClient, {
    account,
    chain: baseConfig.chain,
    address: passport.address,
    abi: passport.abi,
    functionName: "issuePassport",
    args: [
      borrower,
      keccak256(toBytes(`${deploymentLabel}:company`)),
      legalPackHash,
      metadataHash,
      passportExpiry,
      2,
    ],
  });
  await writeAndWait("AccessRegistry.requestAccess", investorWallet, publicClient, {
    account: investorAccount,
    chain: baseConfig.chain,
    address: accessRegistry.address,
    abi: accessRegistry.abi,
    functionName: "requestAccess",
    args: [
      keccak256(toBytes(`${deploymentLabel}:investor:${investorAccount.address}`)),
    ],
  });
  await writeAndWait("AccessRegistry.approveAccess", walletClient, publicClient, {
    account,
    chain: baseConfig.chain,
    address: accessRegistry.address,
    abi: accessRegistry.abi,
    functionName: "approveAccess",
    args: [investorAccount.address],
  });

  const vaults = [
    {
      name: "CreditVault",
      deployment: mainVault,
      dealId: keccak256(toBytes(`${deploymentLabel}:deal-demo`)),
    },
  ];
  if (!options.minimal) {
    vaults.push(
      {
        name: "CreditVaultHappy",
        deployment: deploymentModule.getContractData(
          baseConfig.chain.id.toString(),
          "CreditVaultHappy",
        ) as ContractDeployment,
        dealId: keccak256(toBytes(`${deploymentLabel}:deal-happy`)),
      },
      {
        name: "CreditVaultRecovery",
        deployment: deploymentModule.getContractData(
          baseConfig.chain.id.toString(),
          "CreditVaultRecovery",
        ) as ContractDeployment,
        dealId: keccak256(toBytes(`${deploymentLabel}:deal-recovery`)),
      },
    );
  }
  for (const [index, vault] of vaults.entries()) {
    const fundingDeadline = latestBlock.timestamp + BigInt(7 + index) * DAY;
    const maturityDate = latestBlock.timestamp + BigInt(180 + index) * DAY;
    await writeAndWait(`${vault.name}.initialize`, walletClient, publicClient, {
      account,
      chain: baseConfig.chain,
      address: vault.deployment.address,
      abi: vault.deployment.abi,
      functionName: "initialize",
      args: [
        account.address,
        vault.dealId,
        borrower,
        account.address,
        paymentToken,
        registry.address,
        passport.address,
        accessRegistry.address,
        100_000n * USDC,
        1_000n * USDC,
        1_200,
        200,
        fundingDeadline,
        maturityDate,
        legalPackHash,
        collateralHash,
        // Waterfall costs on default/recovery: 6% legal, 1.5% servicing of
        // principal — same defaults as underwriting.ts::DEFAULT_COSTS, so
        // the on-chain cascade matches the off-chain spec it was ported
        // from.
        600,
        150,
      ],
    });
    await writeAndWait(`Registry.registerVault(${vault.name})`, walletClient, publicClient, {
      account,
      chain: baseConfig.chain,
      address: registry.address,
      abi: registry.abi,
      functionName: "registerVault",
      args: [
        vault.deployment.address,
        borrower,
        account.address,
        paymentToken,
        vault.dealId,
      ],
    });
    // Milestone schedule has to exist before `activate` will accept the
    // vault (CreditVault now escrows the borrower's share and releases it
    // tranche by tranche instead of paying it out in one shot). Four
    // tranches matching lib/data/seed.ts's demo opportunities, so a fresh
    // devnet deploy is immediately activatable from the servicing panel.
    await writeAndWait(`${vault.name}.setMilestones`, walletClient, publicClient, {
      account,
      chain: baseConfig.chain,
      address: vault.deployment.address,
      abi: vault.deployment.abi,
      functionName: "setMilestones",
      args: [[3_000, 2_500, 2_500, 2_000]],
    });
  }

  // RepaymentRouter: the validated repayment entrypoint (dedup by
  // repaymentId) that intermediates custody between a payer and a vault's
  // `record_repayment`. It becomes `msg.sender` on the vault side, so it
  // needs SERVICER_ROLE on the registry — same role a human servicer
  // account would need — and each vault must be explicitly approved.
  let router =
    options.resume &&
    (await loadExistingDeployment("RepaymentRouter", baseConfig, publicClient));
  if (!router) {
    await deployStylusContract({
      ...options,
      contract: "repayment-router",
      name: "RepaymentRouter",
      constructorArgs: [],
    });
    router = deploymentModule.getContractData(
      baseConfig.chain.id.toString(),
      "RepaymentRouter",
    ) as ContractDeployment;
  }
  await writeAndWait("RepaymentRouter.initialize", walletClient, publicClient, {
    account,
    chain: baseConfig.chain,
    address: router.address,
    abi: router.abi,
    functionName: "initialize",
    args: [paymentToken],
  });
  const servicerRole = keccak256(toBytes("SERVICER_ROLE"));
  await writeAndWait("Registry.grantRole(SERVICER_ROLE, RepaymentRouter)", walletClient, publicClient, {
    account,
    chain: baseConfig.chain,
    address: registry.address,
    abi: registry.abi,
    functionName: "grantRole",
    args: [servicerRole, router.address],
  });
  for (const vault of vaults) {
    await writeAndWait(`RepaymentRouter.setVaultApproved(${vault.name})`, walletClient, publicClient, {
      account,
      chain: baseConfig.chain,
      address: router.address,
      abi: router.abi,
      functionName: "setVaultApproved",
      args: [vault.deployment.address, true],
    });
  }

  await writeAndWait("CreditVault.openFunding", walletClient, publicClient, {
    account,
    chain: baseConfig.chain,
    address: mainVault.address,
    abi: mainVault.abi,
    functionName: "openFunding",
  });

  await generateTsAbi(baseConfig.deploymentDir);
  console.log("\n📦 Protocol deployment complete");
  printDeployedAddresses(
    baseConfig.deploymentDir,
    baseConfig.chain.id.toString(),
  );
}
