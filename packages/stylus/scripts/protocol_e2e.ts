import assert from "node:assert/strict";
import {
  Abi,
  Address,
  Hex,
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getContractData } from "./utils/contract";
import { getChain, getRpcUrlFromChain } from "./utils/network";

type ContractData = { address: Address; abi: Abi };
const CHAIN_ID = "412346";
const USDC = 10n ** 6n;
const TARGET = 100_000n * USDC;
const DUE = 112_000n * USDC;
const RECOVERY = 60_000n * USDC;

async function main() {
  const chain = getChain("devnet");
  if (!chain) throw new Error("Nitro devnet configuration missing");
  const devAccounts = (
    chain as typeof chain & { accounts?: Array<{ privateKey: Hex }> }
  ).accounts;
  const [adminConfig, borrowerConfig, investorConfig, outsiderConfig] =
    devAccounts ?? [];
  if (!adminConfig || !borrowerConfig || !investorConfig || !outsiderConfig) {
    throw new Error("Nitro devnet requires four deterministic test accounts");
  }
  const rpcUrl = getRpcUrlFromChain(chain);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const accounts = {
    admin: privateKeyToAccount(adminConfig.privateKey),
    borrower: privateKeyToAccount(borrowerConfig.privateKey),
    investor: privateKeyToAccount(investorConfig.privateKey),
    outsider: privateKeyToAccount(outsiderConfig.privateKey),
  };
  const wallets = {
    admin: createWalletClient({ account: accounts.admin, chain, transport: http(rpcUrl) }),
    borrower: createWalletClient({ account: accounts.borrower, chain, transport: http(rpcUrl) }),
    investor: createWalletClient({ account: accounts.investor, chain, transport: http(rpcUrl) }),
    outsider: createWalletClient({ account: accounts.outsider, chain, transport: http(rpcUrl) }),
  };
  const token = getContractData(CHAIN_ID, "MockUSDC") as ContractData;
  const accessRegistry = getContractData(CHAIN_ID, "AccessRegistry") as ContractData;
  const registry = getContractData(CHAIN_ID, "CreditRegistry") as ContractData;
  const passport = getContractData(CHAIN_ID, "CompanyPassportSBT") as ContractData;
  const demoVault = getContractData(CHAIN_ID, "CreditVault") as ContractData;
  const happyVault = getContractData(CHAIN_ID, "CreditVaultHappy") as ContractData;
  const recoveryVault = getContractData(CHAIN_ID, "CreditVaultRecovery") as ContractData;

  async function write(
    wallet: (typeof wallets)[keyof typeof wallets],
    account: (typeof accounts)[keyof typeof accounts],
    contract: ContractData,
    functionName: string,
    args: readonly unknown[] = [],
  ) {
    const hash = await wallet.writeContract({
      account,
      chain,
      address: contract.address,
      abi: contract.abi,
      functionName,
      args,
    } as never);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, "success", `${functionName} reverted`);
    console.log(`✅ ${functionName}: ${hash}`);
    return hash;
  }

  assert.equal(
    await publicClient.readContract({
      address: passport.address,
      abi: passport.abi,
      functionName: "isVerifiedCompany",
      args: [accounts.borrower.address],
    }),
    true,
  );
  assert.equal(
    await publicClient.readContract({
      address: accessRegistry.address,
      abi: accessRegistry.abi,
      functionName: "isAllowedInvestor",
      args: [accounts.investor.address],
    }),
    true,
  );
  for (const vault of [demoVault, happyVault, recoveryVault]) {
    assert.equal(
      await publicClient.readContract({
        address: registry.address,
        abi: registry.abi,
        functionName: "isVaultRegistered",
        args: [vault.address],
      }),
      true,
    );
  }
  assert.equal(
    await publicClient.readContract({
      address: demoVault.address,
      abi: demoVault.abi,
      functionName: "status",
    }),
    1,
  );

  await write(wallets.admin, accounts.admin, token, "mint", [accounts.investor.address, TARGET * 2n]);
  await write(wallets.admin, accounts.admin, token, "mint", [accounts.borrower.address, DUE]);

  await write(wallets.admin, accounts.admin, happyVault, "openFunding");
  await assert.rejects(
    publicClient.simulateContract({
      account: accounts.outsider,
      address: happyVault.address,
      abi: happyVault.abi,
      functionName: "fund",
      args: [1_000n * USDC],
    }),
    "an investor outside the waitlist must not be able to fund",
  );
  await write(wallets.investor, accounts.investor, token, "approve", [happyVault.address, TARGET]);
  await write(wallets.investor, accounts.investor, happyVault, "fund", [TARGET]);
  await write(wallets.admin, accounts.admin, happyVault, "activate");
  await write(wallets.borrower, accounts.borrower, token, "approve", [happyVault.address, DUE]);
  await write(wallets.borrower, accounts.borrower, happyVault, "recordRepayment", [DUE]);
  await write(wallets.admin, accounts.admin, accessRegistry, "revokeAccess", [
    accounts.investor.address,
  ]);
  assert.equal(
    await publicClient.readContract({
      address: accessRegistry.address,
      abi: accessRegistry.abi,
      functionName: "isAllowedInvestor",
      args: [accounts.investor.address],
    }),
    false,
  );
  // Safe exit: revocation blocks new funding, never claims already earned.
  await write(wallets.investor, accounts.investor, happyVault, "claim");
  const happyPosition = (await publicClient.readContract({
    address: happyVault.address,
    abi: happyVault.abi,
    functionName: "getInvestorPosition",
    args: [accounts.investor.address],
  })) as readonly bigint[];
  assert.deepEqual(happyPosition, [TARGET, DUE, 0n]);

  await write(wallets.investor, accounts.investor, accessRegistry, "requestAccess", [
    keccak256(toBytes(`fouding-local-reapplication:${accounts.investor.address}`)),
  ]);
  await write(wallets.admin, accounts.admin, accessRegistry, "approveAccess", [
    accounts.investor.address,
  ]);

  await write(wallets.admin, accounts.admin, recoveryVault, "openFunding");
  await write(wallets.investor, accounts.investor, token, "approve", [recoveryVault.address, TARGET]);
  await write(wallets.investor, accounts.investor, recoveryVault, "fund", [TARGET]);
  await write(wallets.admin, accounts.admin, recoveryVault, "activate");
  await write(wallets.admin, accounts.admin, recoveryVault, "declareDefault");
  await write(wallets.admin, accounts.admin, recoveryVault, "startRecovery");
  await write(wallets.admin, accounts.admin, token, "mint", [accounts.admin.address, RECOVERY]);
  await write(wallets.admin, accounts.admin, token, "approve", [recoveryVault.address, RECOVERY]);
  await write(wallets.admin, accounts.admin, recoveryVault, "recordRecovery", [RECOVERY]);
  await write(wallets.investor, accounts.investor, recoveryVault, "claim");
  const recoveryPosition = (await publicClient.readContract({
    address: recoveryVault.address,
    abi: recoveryVault.abi,
    functionName: "getInvestorPosition",
    args: [accounts.investor.address],
  })) as readonly bigint[];
  assert.deepEqual(recoveryPosition, [TARGET, RECOVERY, 0n]);

  console.log("\n✅ End-to-end protocol integration passed");
  console.log(`   happy deal: ${keccak256(toBytes("fouding-local-deal-happy-v1"))}`);
  console.log(`   recovery deal: ${keccak256(toBytes("fouding-local-deal-recovery-v1"))}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
