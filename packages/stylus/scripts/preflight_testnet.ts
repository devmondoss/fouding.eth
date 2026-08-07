import { execFileSync } from "child_process";
import { formatEther, http, parseEther, createPublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import "./utils/network";
import { redactSensitiveError } from "./utils/redact";

const REQUIRED_BRANCH = "feat/pr-03-company-passport-testnet";
const MINIMUM_BALANCE = parseEther("0.01");
const PRIVATE_KEY_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function commandOutput(command: string, args: string[]): string {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export async function runTestnetPreflight(): Promise<{
  deployer: `0x${string}`;
  balance: bigint;
  chainId: number;
}> {
  const branch = commandOutput("git", ["branch", "--show-current"]);
  if (branch !== REQUIRED_BRANCH) {
    throw new Error(`Deployment requires branch ${REQUIRED_BRANCH}`);
  }
  commandOutput("git", ["status", "--porcelain"]);
  commandOutput("forge", ["--version"]);
  commandOutput("cargo", ["stylus", "--version"]);

  const rpcUrl = requireEnvironmentVariable("ARBITRUM_SEPOLIA_RPC_URL");
  const privateKey = requireEnvironmentVariable("DEPLOYER_PRIVATE_KEY");
  requireEnvironmentVariable("ETHERSCAN_API_KEY");
  if (!PRIVATE_KEY_PATTERN.test(privateKey)) {
    throw new Error("DEPLOYER_PRIVATE_KEY has an invalid format");
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(rpcUrl),
  });
  const chainId = await publicClient.getChainId();
  if (chainId !== arbitrumSepolia.id) {
    throw new Error(
      `RPC returned chainId ${chainId}; expected ${arbitrumSepolia.id}`,
    );
  }
  const balance = await publicClient.getBalance({ address: account.address });

  console.log(`Deployer: ${account.address}`);
  console.log(`Balance: ${formatEther(balance)} ETH`);
  console.log(`Chain ID: ${chainId}`);

  if (balance < MINIMUM_BALANCE) {
    throw new Error("Deployer balance is below the 0.01 ETH safety threshold");
  }

  return { deployer: account.address, balance, chainId };
}

if (require.main === module) {
  runTestnetPreflight().catch((error: unknown) => {
    console.error(redactSensitiveError(error));
    process.exit(1);
  });
}
