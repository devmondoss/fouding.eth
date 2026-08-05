/**
 * ABI de eventos del CreditVault — PLACEHOLDER.
 *
 * El contrato todavía lo está construyendo el equipo de Rust/Stylus
 * (branch feat/pr-01-scaffold-stylus-foundation). Esta forma se derivó
 * de lo que el frontend YA necesita mostrar (ver ActivityKind en
 * lib/types.ts) para que el indexer se pueda escribir y probar en
 * paralelo sin esperar el contrato final.
 *
 * Cuando el contrato real exista: reemplazar esto por el ABI generado
 * (`cargo stylus export-abi` o el .json que produzca su build), y
 * ajustar `scripts/indexer.ts` si cambian nombres o tipos de campos.
 */
export const CREDIT_VAULT_EVENTS_ABI = [
  {
    type: "event",
    name: "Invested",
    inputs: [
      { name: "investor", type: "address", indexed: true },
      { name: "opportunityId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MilestoneReleased",
    inputs: [
      { name: "opportunityId", type: "uint256", indexed: true },
      { name: "milestoneIndex", type: "uint8", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Repaid",
    inputs: [
      { name: "investor", type: "address", indexed: true },
      { name: "opportunityId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Defaulted",
    inputs: [{ name: "opportunityId", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "RecoveryDistributed",
    inputs: [
      { name: "investor", type: "address", indexed: true },
      { name: "opportunityId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

/**
 * CreditFactory — también placeholder. Un evento por deal desplegado,
 * necesario para que el indexer sepa qué direcciones de CreditVault
 * empezar a escuchar sin tener que hardcodearlas.
 */
export const CREDIT_FACTORY_EVENTS_ABI = [
  {
    type: "event",
    name: "OpportunityCreated",
    inputs: [
      { name: "opportunityId", type: "uint256", indexed: true },
      { name: "vault", type: "address", indexed: true },
      { name: "legalPackHash", type: "bytes32", indexed: false },
    ],
  },
] as const;
