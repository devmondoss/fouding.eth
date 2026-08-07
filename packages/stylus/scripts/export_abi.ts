import * as path from "path";
import * as fs from "fs";
import { spawnSync } from "child_process";
import {
  getExportConfig,
  ensureDeploymentDirectory,
  executeFileCommand,
  generateTsAbi,
  handleSolcError,
  parseAbiOutput,
  writeCleanAbiFile,
} from "./utils/";

const STYLUS_WORKSPACE = path.resolve(__dirname, "../contracts");

function configureSolc(): () => void {
  const nativeSolc = spawnSync("solc", ["--version"], { stdio: "ignore" });
  if (nativeSolc.status === 0) return () => undefined;

  const docker = spawnSync("docker", ["version"], { stdio: "ignore" });
  if (docker.status !== 0) {
    throw new Error(
      "solc is not installed and Docker is unavailable; cannot export JSON ABI",
    );
  }

  const originalPath = process.env["PATH"];
  const dockerSolcDir = path.resolve(__dirname, "bin");
  process.env["PATH"] = originalPath
    ? `${dockerSolcDir}:${originalPath}`
    : dockerSolcDir;
  console.log("🐳 Native solc not found; using Docker solc 0.8.30");

  return () => {
    if (originalPath === undefined) {
      delete process.env["PATH"];
    } else {
      process.env["PATH"] = originalPath;
    }
  };
}

export async function exportStylusAbi(
  contractFolder: string,
  contractName?: string,
  isScript: boolean = true,
  chainId?: string,
) {
  console.log("📄 Starting Stylus ABI export...");

  // Resolve the actual filesystem path (contracts live under contracts/)
  const fsPath = path.join("contracts", contractFolder);
  const config = getExportConfig(fsPath, contractName, chainId);

  if (!config.contractAddress) {
    console.error(
      `❌ Contract address not found. Please deploy the contract first or ensure it is saved in a chain-specific deployment file in ${config.deploymentDir}`,
    );
    process.exit(1);
  }

  if (isScript) {
    console.log(`📄 Contract name: ${config.contractName}`);
    console.log(`📁 Deployment directory: ${config.deploymentDir}`);
    console.log(`📍 Contract address: ${config.contractAddress}`);
    console.log(`🔗 Chain ID: ${config.chainId}`);
  }

  try {
    ensureDeploymentDirectory(config.deploymentDir);

    const restorePath = configureSolc();
    let exportOutput: string;
    try {
      exportOutput = await executeFileCommand(
        {
          executable: "cargo",
          args: [
            "stylus",
            "export-abi",
            "--json",
            `--contract=${contractFolder}`,
          ],
          displayArgs: [
            "stylus",
            "export-abi",
            "--json",
            `--contract=${contractFolder}`,
          ],
          cleanup: () => undefined,
        },
        STYLUS_WORKSPACE,
        "Exporting ABI",
      );
    } finally {
      restorePath();
    }

    console.log(
      `📄 ABI file location: ${config.deploymentDir}/${config.contractFolder}`,
    );

    const abiFilePath = path.resolve(
      config.deploymentDir,
      `${config.contractFolder}`,
    );
    const abi = parseAbiOutput(exportOutput);
    const supplementalEventsPath = path.resolve(fsPath, "abi-events.json");
    if (fs.existsSync(supplementalEventsPath)) {
      const supplementalEvents = parseAbiOutput(
        fs.readFileSync(supplementalEventsPath, "utf8"),
      );
      if (
        !supplementalEvents.every(
          item =>
            typeof item === "object" &&
            item !== null &&
            (item as { type?: unknown }).type === "event",
        )
      ) {
        throw new Error(`${supplementalEventsPath} may only contain ABI events`);
      }
      abi.push(...supplementalEvents);
      console.log(
        `🧩 Added ${supplementalEvents.length} events omitted by cargo-stylus`,
      );
    }
    writeCleanAbiFile(abiFilePath, abi);
    console.log(`✅ Clean ABI written to: ${abiFilePath}`);

    await generateTsAbi(config.deploymentDir);
  } catch (error) {
    handleSolcError(error as Error);
    process.exit(1);
  }
}

if (require.main === module) {
  // Get contract folder from command line args, default to 'your-contract'
  const rawContract = process.argv[2] || "your-contract";
  const chainId = process.argv[3];
  const contractFolder = path.join("contracts", rawContract);
  if (!fs.existsSync(contractFolder)) {
    console.error(`❌ Contract folder does not exist: ${contractFolder}`);
    process.exit(1);
  }
  exportStylusAbi(rawContract, undefined, true, chainId).catch(
    (error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    },
  );
}
