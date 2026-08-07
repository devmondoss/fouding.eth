import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { DeploymentConfig, DeployOptions } from "./type";
import {
  extractGasPriceFromOutput,
  isContractHasConstructor,
} from "./contract";
import { getRpcUrlFromChain } from "./network";
import { createPublicClient, http, formatUnits } from "viem";

const DEFAULT_GAS_FEE_MULTIPLIER = 3;
const MIN_FEE_GWEI = 0.1;

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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fouding-stylus-key-"));
  const privateKeyPath = path.join(directory, "deployer.key");
  fs.writeFileSync(privateKeyPath, `${privateKey}\n`, { mode: 0o600 });

  return {
    privateKeyPath,
    cleanup: () => {
      if (fs.existsSync(privateKeyPath)) fs.unlinkSync(privateKeyPath);
      if (fs.existsSync(directory)) fs.rmdirSync(directory);
    },
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
        resolve(output);
        return;
      }

      console.error(`\n❌ ${description} failed with exit code ${code}`);
      if (errors) console.error(errors);
      reject(
        new Error(
          `Command failed with exit code ${code}. Error output: \n${errorOutput}`,
        ),
      );
    });

    childProcess.on("error", (error: Error) => {
      console.error(`\n❌ ${description} failed:`, error);
      reject(error);
    });
  });
}

export function executeCommand(
  command: string,
  cwd: string,
  description: string,
): Promise<string> {
  console.log(`\n🔄 ${description}...`);
  // Sanitize command to hide private key (create a copy to avoid modifying original)
  const sanitizedCommand = command.slice();
  console.log(
    `Executing: ${sanitizedCommand.replace(/--private-key=[^\s]+/g, "--private-key=***")}`,
  );

  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, [], {
      cwd,
      shell: true,
      stdio: ["inherit", "pipe", "pipe"],
    });

    let output = "";
    let errorOutput = "";
    let errorLines: string[] = [];

    // Handle stdout
    if (childProcess.stdout) {
      childProcess.stdout.on("data", (data: Buffer) => {
        const chunk = data.toString();
        output += chunk;
      });
    }

    // Handle stderr
    if (childProcess.stderr) {
      childProcess.stderr.on("data", (data: Buffer) => {
        const chunk = data.toString();
        errorOutput += chunk;
        const newLines = chunk.split("\n");
        errorLines.push(...newLines);
        // Keep only the last 20 lines, just for safety
        if (errorLines.length > 20) {
          errorLines = errorLines.slice(-20);
        }
      });
    }

    // Handle process completion
    childProcess.on("close", (code: number | null) => {
      // this can extract and detect errors from docker logs because it not throw error code
      const errors = extractErrorLines(errorLines);

      if (code === 0) {
        console.log(`\n✅ ${description} completed successfully!`);
        resolve(output);
      } else {
        console.error(`\n❌ ${description} failed with exit code ${code}`);
        // Print error output starting from "project metadata hash computed on deployment" or error patterns, or all logs if not found
        if (errors) {
          console.error(errors);
          if (
            !command.includes("--no-verify") &&
            errors.includes("mismatch number of constructor arguments")
          ) {
            errorOutput += `\nCan not verify contract with constructor arguments.\n`;
          }
        }

        reject(
          new Error(
            `Command failed with exit code ${code}. Error output: \n${errorOutput}`,
          ),
        );
      }
    });

    // Handle process errors
    childProcess.on("error", (error: Error) => {
      console.error(`\n❌ ${description} failed:`, error);
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
