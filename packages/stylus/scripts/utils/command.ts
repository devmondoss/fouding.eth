import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { DeploymentConfig, DeployOptions } from "./type";
import {
  extractGasPriceFromOutput,
  isContractHasConstructor,
} from "./contract";
import { getRpcUrlFromChain } from "./network";
import { createPublicClient, http, formatUnits } from "viem";
import { redactSensitiveError } from "./redact";

const DEFAULT_GAS_FEE_MULTIPLIER = 3;
const MIN_FEE_GWEI = 0.1;
const STYLUS_WORKSPACE = path.resolve(__dirname, "../../contracts");
const DEPLOY_KEY_DIRECTORY = path.join(STYLUS_WORKSPACE, "target", "deploy-keys");

export interface PreparedCommand {
  executable: string;
  args: string[];
  displayArgs: string[];
  cleanup: () => void;
}

function createPrivateKeyFile(privateKey: string): {
  privateKeyPath: string;
  cleanup: () => void;
} {
  fs.mkdirSync(DEPLOY_KEY_DIRECTORY, { recursive: true, mode: 0o700 });
  const directory = fs.mkdtempSync(path.join(DEPLOY_KEY_DIRECTORY, "run-"));
  fs.chmodSync(directory, 0o700);
  const privateKeyPath = path.join(directory, "deployer.key");
  fs.writeFileSync(privateKeyPath, `${privateKey}\n`, { mode: 0o600 });

  return {
    // cargo-stylus mounts the workspace at /source for reproducible Docker runs.
    privateKeyPath: path.relative(STYLUS_WORKSPACE, privateKeyPath),
    cleanup: () => fs.rmSync(directory, { recursive: true, force: true }),
  };
}

function getGasFeeMultiplier(): number {
  const envVal = process.env["DEPLOY_GAS_FEE_MULTIPLIER"];
  if (envVal) {
    const parsed = parseFloat(envVal);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_GAS_FEE_MULTIPLIER;
}

async function getBufferedMaxFeeGwei(rpcUrl: string): Promise<number> {
  try {
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    });
    const block = await publicClient.getBlock({ blockTag: "latest" });
    if (block.baseFeePerGas === null) {
      return MIN_FEE_GWEI;
    }
    const baseFeeGwei = Number(formatUnits(block.baseFeePerGas, 9));
    const buffered = baseFeeGwei * getGasFeeMultiplier();
    return Math.max(buffered, MIN_FEE_GWEI);
  } catch {
    return MIN_FEE_GWEI;
  }
}

export async function buildDeployCommand(
  config: DeploymentConfig,
  deployOptions: DeployOptions,
): Promise<PreparedCommand> {
  const args = ["stylus", "deploy"];
  const displayArgs = ["stylus", "deploy"];

  args.push(`--contract=${deployOptions.contract}`);
  displayArgs.push(`--contract=${deployOptions.contract}`);

  args.push(`--endpoint=${getRpcUrlFromChain(config.chain)}`);
  displayArgs.push("--endpoint=***");
  if (deployOptions.estimateGas) {
    args.push("--estimate-gas");
    displayArgs.push("--estimate-gas");
  } else {
    if (deployOptions.maxFee) {
      args.push(`--max-fee-per-gas-gwei=${deployOptions.maxFee}`);
      displayArgs.push(`--max-fee-per-gas-gwei=${deployOptions.maxFee}`);
    } else {
      // maxFeePerGas is a ceiling. A buffer avoids a deployment racing a rising base fee.
      const rpcUrl = getRpcUrlFromChain(config.chain);
      const maxFeeGwei = await getBufferedMaxFeeGwei(rpcUrl);
      args.push(`--max-fee-per-gas-gwei=${maxFeeGwei}`);
      displayArgs.push(`--max-fee-per-gas-gwei=${maxFeeGwei}`);
    }
  }

  if (!deployOptions.verify) {
    args.push("--no-verify");
    displayArgs.push("--no-verify");
  } else {
    if (
      deployOptions.constructorArgs &&
      deployOptions.constructorArgs.length > 0 &&
      isContractHasConstructor(config.contractFolder)
    ) {
      throw new Error(
        "Verification is not currently supported with constructors. Please implement and use initialize() function to initialize your contracts: Refer to readme.md for tutorial",
      );
    }
  }

  if (
    deployOptions.constructorArgs &&
    deployOptions.constructorArgs.length > 0 &&
    !deployOptions.isOrbit
  ) {
    args.push(
      "--constructor-args",
      ...deployOptions.constructorArgs.map((argument) => String(argument)),
    );
    displayArgs.push(
      "--constructor-args",
      ...deployOptions.constructorArgs.map((argument) => String(argument)),
    );
  }

  const { privateKeyPath, cleanup } = createPrivateKeyFile(config.privateKey);
  args.push(`--private-key-path=${privateKeyPath}`);
  displayArgs.push("--private-key-path=***");

  return { executable: "cargo", args, displayArgs, cleanup };
}

export async function estimateGasPrice(
  config: DeploymentConfig,
  deployOptions: DeployOptions,
): Promise<string> {
  const prepared = await buildDeployCommand(config, {
    ...deployOptions,
    estimateGas: true,
    verify: false,
  });
  let deployOutput: string;
  try {
    deployOutput = await executeFileCommand(
      prepared,
      config.contractName,
      "Estimating gas price with cargo stylus",
    );
  } finally {
    prepared.cleanup();
  }
  const gasPrice = extractGasPriceFromOutput(deployOutput);
  if (gasPrice) {
    return gasPrice;
  }
  return "0";
}

export function executeFileCommand(
  prepared: PreparedCommand,
  cwd: string,
  description: string,
): Promise<string> {
  console.log(`\n🔄 ${description}...`);
  console.log(`Executing: ${prepared.executable} ${prepared.displayArgs.join(" ")}`);

  return new Promise((resolve, reject) => {
    const childProcess = spawn(prepared.executable, prepared.args, {
      cwd,
      shell: false,
      stdio: ["inherit", "pipe", "pipe"],
    });

    let output = "";
    let errorOutput = "";
    let errorLines: string[] = [];

    childProcess.stdout?.on("data", (data: Buffer) => {
      output += data.toString();
    });
    childProcess.stderr?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      errorOutput += chunk;
      errorLines.push(...chunk.split("\n"));
      if (errorLines.length > 20) errorLines = errorLines.slice(-20);
    });

    childProcess.on("close", (code: number | null) => {
      const errors = extractErrorLines(errorLines);
      if (code === 0) {
        console.log(`\n✅ ${description} completed successfully!`);
        resolve(`${output}\n${errorOutput}`);
        return;
      }

      console.error(`\n❌ ${description} failed with exit code ${code}`);
      if (errors) console.error(redactSensitiveError(errors));
      reject(
        new Error(
          `Command failed with exit code ${code}. Error output: \n${redactSensitiveError(errorOutput)}`,
        ),
      );
    });

    childProcess.on("error", (error: Error) => {
      console.error(`\n❌ ${description} failed:`, redactSensitiveError(error));
      reject(error);
    });
  });
}

function extractErrorLines(errorLines: string[]): string | null {
  let output: string = "";
  if (errorLines.length > 0) {
    const metadataIndex = errorLines.findIndex((line) =>
      line.includes("project metadata hash computed on deployment"),
    );
    const errorIndex = errorLines.findIndex(
      (line) =>
        line.toLowerCase().includes("error[") ||
        line.toLowerCase().includes("error:"),
    );

    let startIndex = -1;
    if (metadataIndex >= 0) {
      startIndex = metadataIndex;
    } else if (errorIndex >= 0) {
      startIndex = errorIndex;
    }

    if (startIndex === -1) {
      return null;
    }

    const linesToPrint = errorLines.slice(startIndex);
    linesToPrint.forEach((line) => {
      if (line.trim()) output += line + "\n";
    });
    return output;
  }
  return null;
}
