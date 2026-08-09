/**
 * Expediente que una empresa manda a revisión antes de publicarse como
 * Opportunity. Corresponde al estado "review" de OpportunityStatus
 * (lib/types.ts) — esto es lo que produce ese estado.
 */
export type SubmissionStatus =
  | "pending" // enviado, en cola, nadie lo tomó todavía
  | "in_review" // un verificador lo tomó y está trabajando sobre él
  | "approved"
  | "rejected";

export type VerifierSubmission = {
  id: string;
  companyName: string;
  companyRuc: string;
  /** Wallet de la empresa que pide. El pasaporte ya no cuelga de acá:
   * lo emite la acreditación de la empresa (lib/verifier/companies.ts). */
  companyWallet: string;
  /** Empresa acreditada de la que cuelga esta solicitud. Null solo en los
   * expedientes viejos, de cuando empresa y proyecto eran un mismo
   * trámite. */
  companyId: string | null;

  /* Perfil de la empresa — se declara acá y el verificador lo contrasta;
     al publicar viaja tal cual a la tabla `companies`. */
  sector: string;
  city: string;
  yearsOperating: number;
  /** Ventas del último año, en USDC enteros. Declarado, no verificado. */
  annualRevenue: string;

  projectTitle: string;
  /** Clave de PROJECT_TYPES (lib/verifier/submission.ts). */
  projectType: string;
  /** Para qué es el capital, en palabras de la empresa. */
  useOfFunds: string;
  requestedAmount: string; // string: evita perder precisión de bigint en JSON
  /** Plazo pedido, en meses. El definitivo lo fija el verificador al publicar. */
  termMonths: number;

  /* Garantía ofrecida. Es una declaración, no una tasación: el valor neto
     recuperable lo calcula el verificador al publicar, con su haircut. */
  collateralKind: string;
  collateralValue: string;
  collateralDetail: string;

  /** keccak256 del legal pack — el documento en sí NUNCA se sube acá,
   * solo su hash (ver docs/conceptos-y-cambios.md §SUNAT). */
  legalPackHash: string;
  /** Nombre del archivo, solo para que la empresa reconozca qué mandó. */
  legalPackName: string;

  status: SubmissionStatus;
  submittedAt: string;
  /** Verificador que tomó el expediente (puede no haber decidido aún). */
  reviewer: string | null;
  reviewStartedAt: string | null;
  decidedAt: string | null;
  /** Wallet del verificador que decidió — para el honorario fijo y el
   * stake, ver docs/conceptos-y-cambios.md §Verificador. */
  decidedBy: string | null;
  note: string | null;
  passportTxHash: string | null;
  passportTokenId: string | null;
  passportChainId: number | null;
  passportContractAddress: string | null;
  onchainSyncedAt: string | null;
};

/**
 * Bitácora append-only del expediente. Un estado dice dónde está; esto
 * dice quién lo movió y cuándo — que es lo que la empresa preguntaba y no
 * tenía dónde leer.
 */
export type SubmissionEventKind =
  | "submitted"
  | "claimed"
  | "approved"
  | "rejected"
  | "published";

export type SubmissionEvent = {
  id: string;
  submissionId: string;
  kind: SubmissionEventKind;
  /** Nombre del verificador, o la wallet de la empresa que envió. */
  actor: string;
  actorRole: "business" | "verifier" | "system";
  detail: string | null;
  createdAt: string;
};

export type SubmissionWithEvents = VerifierSubmission & {
  events: SubmissionEvent[];
};

export type CreateSubmissionInput = Omit<
  VerifierSubmission,
  | "id"
  | "status"
  | "submittedAt"
  | "reviewer"
  | "reviewStartedAt"
  | "decidedAt"
  | "decidedBy"
  | "note"
  | "passportTxHash"
  | "passportTokenId"
  | "passportChainId"
  | "passportContractAddress"
  | "onchainSyncedAt"
>;

export type DecisionInput = {
  approve: boolean;
  decidedBy: string;
  note?: string;
  passport?: PassportSynchronization;
};

export type PassportSynchronization = {
  txHash: string;
  tokenId: string;
  chainId: number;
  contractAddress: string;
};

/** Vista pública mínima. Nunca incluye documentos, notas ni datos personales. */
export type PublicCompanyEvidence = {
  companyName: string;
  companyRuc: string;
  legalPackHash: string;
  verificationStatus: SubmissionStatus;
  verifier: string | null;
  lastReviewedAt: string | null;
  onchainTxHash: string | null;
};
