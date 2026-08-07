import assert from "node:assert/strict";
import { buildFrontendContracts } from "./utils/abi";
import { loadDeployedContracts } from "./utils/contract";

const expectedContracts = buildFrontendContracts("deployments");
const frontendContracts = loadDeployedContracts() as typeof expectedContracts;

for (const [chainId, contracts] of Object.entries(expectedContracts)) {
  for (const [contractName, expected] of Object.entries(contracts)) {
    const frontend = frontendContracts[chainId]?.[contractName];
    assert.ok(
      frontend,
      `Frontend contract ${contractName} missing on chain ${chainId}`,
    );
    assert.equal(
      frontend.address,
      expected.address,
      `Address mismatch for ${contractName} on chain ${chainId}`,
    );
    assert.equal(
      frontend.txHash,
      expected.txHash,
      `Transaction hash mismatch for ${contractName} on chain ${chainId}`,
    );
    assert.deepEqual(
      frontend.abi,
      expected.abi,
      `ABI mismatch for ${contractName} on chain ${chainId}`,
    );
    console.log(
      `✅ ${chainId}/${contractName}: address, txHash, and ABI synchronized`,
    );

    if (contractName === "CompanyPassportSBT") {
      const passportAbi = expected.abi as Array<{
        type?: string;
        name?: string;
      }>;
      const functionNames = new Set(
        passportAbi
          .filter((entry) => entry.type === "function")
          .map((entry) => entry.name),
      );
      assert.ok(
        functionNames.has("passportOf"),
        `${chainId}/CompanyPassportSBT ABI missing passportOf(address)`,
      );
      assert.ok(
        functionNames.has("credentialOf"),
        `${chainId}/CompanyPassportSBT ABI missing credentialOf(uint256)`,
      );
      assert.ok(
        !functionNames.has("passportIdByWallet"),
        `${chainId}/CompanyPassportSBT ABI contains non-canonical passportIdByWallet`,
      );
      console.log(
        `✅ ${chainId}/CompanyPassportSBT: canonical passport read interface`,
      );
    }
  }
}
