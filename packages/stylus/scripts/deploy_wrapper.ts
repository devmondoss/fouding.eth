import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import { DeployCommandOptions, DeployOptions } from "./utils/type";
import deployScript from "./deploy";
import { redactSensitiveError } from "./utils/redact";

/**
 * Entry point for the deploy script
 * This script is used to deploy a single contract or all contracts in the stylus folder
 */
if (require.main === module) {
  // Use yargs for argument parsing
  const argv = yargs(hideBin(process.argv))
    .usage("Usage: yarn deploy --name <contractName> --network <network>")
    .option("network", {
      alias: "net",
      describe: "Network to deploy to",
      type: "string",
      demandOption: false,
    })
    .option("estimate-gas", {
      alias: "eg",
      describe: "Estimate gas for the deployment",
      type: "boolean",
      demandOption: false,
    })
    .option("max-fee", {
      alias: "mf",
      describe: "Max fee per gas gwei",
      type: "string",
      demandOption: false,
    })
    .option("verify", {
      describe: "Verify Solidity source and the reproducible Stylus deployment",
      type: "boolean",
      default: false,
    })
    .option("minimal", {
      describe: "Deploy one CreditVault instead of the three local lifecycle fixtures",
      type: "boolean",
      default: false,
    })
    .option("resume", {
      describe: "Reuse valid contracts from the chain deployment manifest",
      type: "boolean",
      default: false,
    })
    .help()
    .parseSync() as DeployCommandOptions;

  deployScript(argv as DeployOptions).catch((error) => {
    console.error("Fatal error:", redactSensitiveError(error));
    process.exit(1);
  });
}
