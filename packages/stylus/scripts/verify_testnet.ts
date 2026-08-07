import * as fs from "fs";
import * as path from "path";
import { Address } from "viem";
import { runTestnetPreflight } from "./preflight_testnet";
import { executeFileCommand } from "./utils/command";
import { parseContractDeployment } from "./utils/deployment";
import { verifySoliditySource } from "./verify_solidity_explorer";
import { verifyStylusSourceOnExplorer } from "./verify_stylus_explorer";
import { redactSensitiveError } from "./utils/redact";

const CHAIN_ID = "421614";
const DEPLOYMENT_FILE = path.resolve(__dirname, `../deployments/${CHAIN_ID}_latest.json`);
const STYLUS_WORKSPACE = path.resolve(__dirname, "../contracts");

const SOLIDITY_CONTRACTS = [
  "MockUSDC",
  "AccessRegistry",
  "CompanyPassportSBT",
  "CreditRegistry",
] as const;

async function verifyTestnet(): Promise<void> {
  const preflight = await runTestnetPreflight();
  if (!fs.existsSync(DEPLOYMENT_FILE)) {
    throw new Error(`Deployment manifest not found: ${DEPLOYMENT_FILE}`);
  }
  const manifest: unknown = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf8"));
  const rpcUrl = process.env["ARBITRUM_SEPOLIA_RPC_URL"]!;

  for (const contractName of SOLIDITY_CONTRACTS) {
    const deployment = parseContractDeployment(manifest, contractName, CHAIN_ID);
    verifySoliditySource({
      address: deployment.address as Address,
      source: contractName,
      contractName,
      admin: preflight.deployer,
      chainId: preflight.chainId,
      rpcUrl,
    });
  }

  const vault = parseContractDeployment(manifest, "CreditVault", CHAIN_ID);
  await executeFileCommand(
    {
      executable: "cargo",
      args: [
        "stylus",
        "verify",
        "--contract=credit-vault",
        `--endpoint=${rpcUrl}`,
        `--deployment-tx=${vault.txHash}`,
      ],
      displayArgs: [
        "stylus",
        "verify",
        "--contract=credit-vault",
        "--endpoint=***",
        `--deployment-tx=${vault.txHash}`,
      ],
      cleanup: () => undefined,
    },
    STYLUS_WORKSPACE,
    "Verifying reproducible CreditVault deployment",
  );
  await verifyStylusSourceOnExplorer(vault.address as Address);
}

verifyTestnet().catch((error: unknown) => {
  console.error(redactSensitiveError(error));
  process.exit(1);
});
