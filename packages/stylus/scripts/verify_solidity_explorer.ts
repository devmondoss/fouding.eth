import { execFileSync } from "child_process";
import * as path from "path";
import { Address, encodeAbiParameters } from "viem";

const FOUNDRY_ROOT = path.resolve(__dirname, "../../foundry");

export function verifySoliditySource(options: {
  address: Address;
  source: string;
  contractName: string;
  admin: Address;
  chainId: number;
  rpcUrl: string;
}): void {
  const constructorArgs = encodeAbiParameters(
    [{ type: "address" }],
    [options.admin],
  );
  execFileSync(
    "forge",
    [
      "verify-contract",
      "--root",
      FOUNDRY_ROOT,
      "--chain",
      String(options.chainId),
      "--verifier",
      "etherscan",
      "--watch",
      "--constructor-args",
      constructorArgs,
      options.address,
      `src/${options.source}.sol:${options.contractName}`,
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        ETH_RPC_URL: options.rpcUrl,
      },
    },
  );
}
