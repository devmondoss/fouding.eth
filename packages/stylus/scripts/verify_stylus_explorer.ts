import { execFileSync } from "child_process";
import { Address } from "viem";

const ETHERSCAN_V2_API = "https://api.etherscan.io/v2/api";
const ARBITRUM_SEPOLIA_CHAIN_ID = "421614";
const CONTRACT_SOURCE_PATH = "packages/stylus/contracts";

interface EtherscanResponse {
  status: string;
  message: string;
  result: string;
}

function requireApiKey(): string {
  const apiKey = process.env["ETHERSCAN_API_KEY"]?.trim();
  if (!apiKey) throw new Error("ETHERSCAN_API_KEY is not set");
  return apiKey;
}

function commandOutput(command: string, args: string[]): string {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function getPublicSourceUrl(): string {
  const dirtySource = commandOutput("git", [
    "status",
    "--porcelain",
    "--",
    CONTRACT_SOURCE_PATH,
  ]);
  if (dirtySource) {
    throw new Error("Stylus source has uncommitted changes and cannot be published reproducibly");
  }

  const remote = commandOutput("git", ["remote", "get-url", "origin"])
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "");
  if (!remote.startsWith("https://github.com/")) {
    throw new Error("Stylus explorer verification requires a public GitHub origin");
  }
  const commit = commandOutput("git", ["rev-parse", "HEAD"]);
  return `${remote}/tree/${commit}/${CONTRACT_SOURCE_PATH}`;
}

function getCargoStylusVersion(): string {
  const versionOutput = commandOutput("cargo", ["stylus", "--version"]);
  const match = versionOutput.match(/(\d+\.\d+\.\d+)/);
  if (!match?.[1]) throw new Error("Could not determine cargo-stylus version");
  return `stylus:${match[1]}`;
}

async function etherscanRequest(
  parameters: Record<string, string>,
): Promise<EtherscanResponse> {
  const response = await fetch(ETHERSCAN_V2_API, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(parameters),
  });
  if (!response.ok) {
    throw new Error(`Etherscan request failed with HTTP ${response.status}`);
  }
  return (await response.json()) as EtherscanResponse;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function verifyStylusSourceOnExplorer(
  contractAddress: Address,
): Promise<void> {
  const apiKey = requireApiKey();
  const common = {
    apikey: apiKey,
    chainid: ARBITRUM_SEPOLIA_CHAIN_ID,
    module: "contract",
  };
  const submission = await etherscanRequest({
    ...common,
    action: "verifysourcecode",
    codeformat: "stylus",
    sourceCode: getPublicSourceUrl(),
    contractaddress: contractAddress,
    contractname: "credit-vault",
    compilerversion: getCargoStylusVersion(),
    licenseType: "3",
  });

  if (
    submission.status !== "1" &&
    !submission.result.toLowerCase().includes("already verified")
  ) {
    throw new Error(`Stylus explorer verification rejected: ${submission.result}`);
  }
  if (submission.result.toLowerCase().includes("already verified")) return;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    await wait(5_000);
    const status = await etherscanRequest({
      ...common,
      action: "checkverifystatus",
      guid: submission.result,
    });
    if (status.status === "1" && status.result.toLowerCase().includes("pass")) {
      console.log("✅ CreditVault source verified on Arbiscan");
      return;
    }
    if (!status.result.toLowerCase().includes("pending")) {
      throw new Error(`Stylus explorer verification failed: ${status.result}`);
    }
  }

  throw new Error("Stylus explorer verification timed out");
}
