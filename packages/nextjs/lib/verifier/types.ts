/**
 * Expediente que una empresa manda a revisión antes de publicarse como
 * Opportunity. Corresponde al estado "review" de OpportunityStatus
 * (lib/types.ts) — esto es lo que produce ese estado.
 */
export type SubmissionStatus = "pending" | "approved" | "rejected";

export type VerifierSubmission = {
  id: string;
  companyName: string;
  companyRuc: string;
  /** Wallet que recibirá o actualizará su CompanyPassportSBT al aprobarse. */
  companyWallet: string;
  projectTitle: string;
  requestedAmount: string; // string: evita perder precisión de bigint en JSON
  /** keccak256 del legal pack — el documento en sí NUNCA se sube acá,
   * solo su hash (ver conceptos-y-cambios.md §SUNAT). */
  legalPackHash: string;
  status: SubmissionStatus;
  submittedAt: string;
  decidedAt: string | null;
  /** Wallet del verificador que decidió — para el honorario fijo y el
   * stake, ver conceptos-y-cambios.md §Verificador. */
  decidedBy: string | null;
  note: string | null;
};

export type CreateSubmissionInput = Omit<
  VerifierSubmission,
  "id" | "status" | "submittedAt" | "decidedAt" | "decidedBy" | "note"
>;

export type DecisionInput = {
  approve: boolean;
  decidedBy: string;
  note?: string;
};
