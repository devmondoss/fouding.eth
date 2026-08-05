/**
 * cargo-stylus 0.10.8 omits `sol!` events from `export-abi --json`.
 * This declaration mirrors credit-vault/abi-events.json and is also merged
 * into the generated deployment ABI by scripts/export_abi.ts.
 */
export const CREDIT_VAULT_EVENTS_ABI = [
  {
    type: "event",
    name: "VaultInitialized",
    inputs: [
      { name: "dealId", type: "bytes32", indexed: true },
      { name: "borrower", type: "address", indexed: true },
      { name: "originator", type: "address", indexed: true },
      { name: "paymentToken", type: "address", indexed: false },
      { name: "accessRegistry", type: "address", indexed: false },
      { name: "fundingTarget", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FundingOpened",
    inputs: [{ name: "fundingDeadline", type: "uint64", indexed: false }],
  },
  {
    type: "event",
    name: "Funded",
    inputs: [
      { name: "investor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "totalFunded", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FundingCompleted",
    inputs: [{ name: "totalFunded", type: "uint256", indexed: false }],
  },
  {
    type: "event",
    name: "FundingCancelled",
    inputs: [{ name: "refundableAmount", type: "uint256", indexed: false }],
  },
  {
    type: "event",
    name: "Activated",
    inputs: [
      { name: "principalOutstanding", type: "uint256", indexed: false },
      { name: "borrowerProceeds", type: "uint256", indexed: false },
      { name: "platformFee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RepaymentRecorded",
    inputs: [
      { name: "payer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "totalRepaid", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "investor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "totalClaimed", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DefaultDeclared",
    inputs: [
      { name: "principalOutstanding", type: "uint256", indexed: false },
    ],
  },
  { type: "event", name: "RecoveryStarted", inputs: [] },
  {
    type: "event",
    name: "RecoveryRecorded",
    inputs: [
      { name: "payer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "totalRepaid", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Closed",
    inputs: [
      { name: "totalRepaid", type: "uint256", indexed: false },
      { name: "totalClaimed", type: "uint256", indexed: false },
    ],
  },
] as const;
