import { sql } from "../db/client";
import type {
  CreateSubmissionInput,
  DecisionInput,
  SubmissionStatus,
  VerifierSubmission,
} from "./types";

type SubmissionRow = {
  id: string;
  company_name: string;
  company_ruc: string;
  company_wallet: string;
  project_title: string;
  requested_amount: string;
  legal_pack_hash: string;
  status: SubmissionStatus;
  submitted_at: string;
  decided_at: string | null;
  decided_by: string | null;
  note: string | null;
};

function toSubmission(row: SubmissionRow): VerifierSubmission {
  return {
    id: row.id,
    companyName: row.company_name,
    companyRuc: row.company_ruc,
    companyWallet: row.company_wallet,
    projectTitle: row.project_title,
    requestedAmount: row.requested_amount,
    legalPackHash: row.legal_pack_hash,
    status: row.status,
    submittedAt: row.submitted_at,
    decidedAt: row.decided_at,
    decidedBy: row.decided_by,
    note: row.note,
  };
}

export async function listSubmissions(): Promise<VerifierSubmission[]> {
  const rows = (await sql`
    SELECT * FROM verifier_submissions ORDER BY submitted_at DESC
  `) as SubmissionRow[];
  return rows.map(toSubmission);
}

/** Para app/solicitar: una empresa logueada consulta sus propias
 * solicitudes por wallet — sin API key, así que no expone nada de
 * las demás (ver GET /api/verifier/submissions/mine). */
export async function listSubmissionsByWallet(
  wallet: string,
): Promise<VerifierSubmission[]> {
  const rows = (await sql`
    SELECT * FROM verifier_submissions
    WHERE lower(company_wallet) = lower(${wallet})
    ORDER BY submitted_at DESC
  `) as SubmissionRow[];
  return rows.map(toSubmission);
}

export async function getSubmission(
  id: string,
): Promise<VerifierSubmission | null> {
  const rows = (await sql`
    SELECT * FROM verifier_submissions WHERE id = ${id} LIMIT 1
  `) as SubmissionRow[];
  return rows[0] ? toSubmission(rows[0]) : null;
}

export async function createSubmission(
  input: CreateSubmissionInput,
): Promise<VerifierSubmission> {
  const rows = (await sql`
    INSERT INTO verifier_submissions
      (company_name, company_ruc, company_wallet, project_title, requested_amount, legal_pack_hash)
    VALUES
      (${input.companyName}, ${input.companyRuc}, ${input.companyWallet}, ${input.projectTitle}, ${input.requestedAmount}, ${input.legalPackHash})
    RETURNING *
  `) as SubmissionRow[];
  return toSubmission(rows[0]);
}

export async function decideSubmission(
  id: string,
  decision: DecisionInput,
): Promise<VerifierSubmission | null> {
  const status: SubmissionStatus = decision.approve ? "approved" : "rejected";
  const rows = (await sql`
    UPDATE verifier_submissions
    SET status = ${status}, decided_at = now(), decided_by = ${decision.decidedBy}, note = ${decision.note ?? null}
    WHERE id = ${id}
    RETURNING *
  `) as SubmissionRow[];

  return rows[0] ? toSubmission(rows[0]) : null;
}
