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
import deployStylusContract from "./deploy_contract";
import { runTestnetPreflight } from "./preflight_testnet";
import { verifySoliditySource } from "./verify_solidity_explorer";
import {
  generateTsAbi,
  getDeploymentConfig,
  getRpcUrlFromChain,
  printDeployedAddresses,
  saveDeployment,
  writeCleanAbiFile,
} from "./utils/";
import { DeployOptions, DeploymentConfig } from "./utils/type";

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
const USDC = 10n ** 6n;
const DAY = 24n * 60n * 60n;

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

  archiveLatestDeployment(baseConfig.deploymentDir, baseConfig.chain.id);

  execFileSync("forge", ["build", "--root", FOUNDRY_ROOT], {
    stdio: "inherit",
  });

  const mockUsdc = await deploySolidity(
    "MockUSDC",
    "MockUSDC",
    baseConfig,
    walletClient,
    publicClient,
    account.address,
    Boolean(options.verify),
  );
  const accessRegistry = await deploySolidity(
    "AccessRegistry",
    "AccessRegistry",
    baseConfig,
    walletClient,
    publicClient,
    account.address,
    Boolean(options.verify),
  );
  const passport = await deploySolidity(
    "CompanyPassportSBT",
    "CompanyPassportSBT",
    baseConfig,
    walletClient,
    publicClient,
    account.address,
    Boolean(options.verify),
  );
  const registry = await deploySolidity(
    "CreditRegistry",
    "CreditRegistry",
    baseConfig,
    walletClient,
    publicClient,
    account.address,
    Boolean(options.verify),
  );

  await deployStylusContract({
    ...options,
    contract: "credit-vault",
    name: "CreditVault",
    constructorArgs: [],
  });
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
  const mainVault = deploymentModule.getContractData(
    baseConfig.chain.id.toString(),
    "CreditVault",
  ) as ContractDeployment;

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
    args: [mockUsdc.address, true],
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
        mockUsdc.address,
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
        mockUsdc.address,
        vault.dealId,
      ],
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
