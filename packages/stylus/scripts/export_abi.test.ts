import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildFrontendContracts, parseAbiOutput } from "./utils/abi";
import { parseContractDeployment } from "./utils/deployment";

const ADDRESS = "0xab8e440727a38bbb180f7032ca4a8009e7b52b80";
const TX_HASH =
  "0xfc743230e73bdf472977282d9684628d63128069820e1d9806e5c16c9341bfec";
const ABI = [
  {
    inputs: [],
    name: "greeting",
    outputs: [{ type: "string" }],
    stateMutability: "view",
    type: "function",
  },
];

const deploymentDocument = {
  "your-contract": {
    address: ADDRESS,
    txHash: TX_HASH,
    contract: "your-contract",
  },
};

interface TestCase {
  name: string;
  run: () => void;
}

const tests: TestCase[] = [
  {
    name: "parses ABI with solc headers",
    run: () => {
      const output = `======= <stdin>:IYourContract =======\nContract JSON ABI\n${JSON.stringify(ABI)}\n`;
      assert.deepEqual(parseAbiOutput(output), ABI);
    },
  },
  {
    name: "parses an already-clean JSON ABI",
    run: () => assert.deepEqual(parseAbiOutput(JSON.stringify(ABI)), ABI),
  },
  {
    name: "rejects output without JSON",
    run: () =>
      assert.throws(
        () => parseAbiOutput("Contract JSON ABI unavailable"),
        /No JSON ABI found/,
      ),
  },
  {
    name: "reads a nested contract deployment",
    run: () => {
      const deployment = parseContractDeployment(
        deploymentDocument,
        "your-contract",
        "412346",
      );
      assert.equal(deployment.address, ADDRESS);
      assert.equal(deployment.txHash, TX_HASH);
    },
  },
  {
    name: "rejects an absent contract",
    run: () =>
      assert.throws(
        () =>
          parseContractDeployment(
            deploymentDocument,
            "missing-contract",
            "412346",
          ),
        /Contract missing-contract not found/,
      ),
  },
  {
    name: "synchronizes address, transaction hash, and ABI",
    run: () => {
      const temporaryDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "founding-abi-test-"),
      );
      try {
        fs.writeFileSync(
          path.join(temporaryDir, "412346_latest.json"),
          JSON.stringify(deploymentDocument),
        );
        fs.writeFileSync(
          path.join(temporaryDir, "your-contract"),
          JSON.stringify(ABI),
        );

        const generated = buildFrontendContracts(temporaryDir);
        const contract = generated["412346"]?.["your-contract"];
        assert.equal(contract?.address, ADDRESS);
        assert.equal(contract?.txHash, TX_HASH);
        assert.deepEqual(contract?.abi, ABI);
      } finally {
        fs.rmSync(temporaryDir, { recursive: true, force: true });
      }
    },
  },
  {
    name: "rejects invalid ABI JSON",
    run: () =>
      assert.throws(
        () => parseAbiOutput("Contract JSON ABI\n[{]"),
        /No valid JSON ABI array found/,
      ),
  },
];

for (const test of tests) {
  test.run();
  console.log(`✅ ${test.name}`);
}

console.log(`✅ ABI pipeline tests passed (${tests.length}/${tests.length})`);
