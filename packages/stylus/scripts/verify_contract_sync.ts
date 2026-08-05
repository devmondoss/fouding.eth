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
  }
}
