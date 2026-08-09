import "server-only";

import { sql } from "../db/client";
import type {
  CreateSubmissionInput,
  DecisionInput,
  PublicCompanyEvidence,
  SubmissionEvent,
  SubmissionEventKind,
  SubmissionStatus,
  SubmissionWithEvents,
  VerifierSubmission,
} from "./types";

type SubmissionRow = {
  id: string;
  company_name: string;
  company_ruc: string;
  company_wallet: string;
  sector: string;
  city: string;
  years_operating: number;
  annual_revenue: string;
  project_title: string;
  project_type: string;
  use_of_funds: string;
  requested_amount: string;
  term_months: number;
  collateral_kind: string;
  collateral_value: string;
  collateral_detail: string;
  legal_pack_hash: string;
  legal_pack_name: string;
  status: SubmissionStatus;
  submitted_at: string;
  reviewer: string | null;
  review_started_at: string | null;
  decided_at: string | null;
  decided_by: string | null;
  note: string | null;
  passport_tx_hash: string | null;
  passport_token_id: string | null;
  passport_chain_id: number | null;
  passport_contract_address: string | null;
  onchain_synced_at: string | null;
};

type EventRow = {
  id: string;
  submission_id: string;
  kind: SubmissionEventKind;
  actor: string;
  actor_role: SubmissionEvent["actorRole"];
  detail: string | null;
  created_at: string;
};

function toSubmission(row: SubmissionRow): VerifierSubmission {
  return {
    id: row.id,
    companyName: row.company_name,
    companyRuc: row.company_ruc,
    companyWallet: row.company_wallet,
    sector: row.sector ?? "",
    city: row.city ?? "",
    yearsOperating: row.years_operating ?? 0,
    annualRevenue: row.annual_revenue ?? "",
    projectTitle: row.project_title,
    projectType: row.project_type ?? "",
    useOfFunds: row.use_of_funds ?? "",
    requestedAmount: row.requested_amount,
    termMonths: row.term_months ?? 0,
    collateralKind: row.collateral_kind ?? "",
    collateralValue: row.collateral_value ?? "",
    collateralDetail: row.collateral_detail ?? "",
    legalPackHash: row.legal_pack_hash,
    legalPackName: row.legal_pack_name ?? "",
    status: row.status,
    submittedAt: row.submitted_at,
    reviewer: row.reviewer,
    reviewStartedAt: row.review_started_at,
    decidedAt: row.decided_at,
    decidedBy: row.decided_by,
    note: row.note,
    passportTxHash: row.passport_tx_hash,
    passportTokenId: row.passport_token_id,
    passportChainId: row.passport_chain_id,
    passportContractAddress: row.passport_contract_address,
    onchainSyncedAt: row.onchain_synced_at,
  };
}

function toEvent(row: EventRow): SubmissionEvent {
  return {
    id: row.id,
    submissionId: row.submission_id,
    kind: row.kind,
    actor: row.actor,
    actorRole: row.actor_role,
    detail: row.detail,
    createdAt: row.created_at,
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
 * las demás (ver GET /api/verifier/submissions/mine).
 *
 * Trae la bitácora en la misma llamada: el dashboard la necesita siempre
 * (es el seguimiento de la revisión), así que pedirla aparte sería una
 * cascada garantizada. */
export async function listSubmissionsByWallet(
  wallet: string,
): Promise<SubmissionWithEvents[]> {
  const rows = (await sql`
    SELECT * FROM verifier_submissions
    WHERE lower(company_wallet) = lower(${wallet})
    ORDER BY submitted_at DESC
  `) as SubmissionRow[];

  if (rows.length === 0) return [];

  const eventRows = (await sql`
    SELECT * FROM submission_events
    WHERE submission_id IN (
      SELECT id FROM verifier_submissions
      WHERE lower(company_wallet) = lower(${wallet})
    )
    ORDER BY created_at ASC
  `) as EventRow[];

  const bySubmission = new Map<string, SubmissionEvent[]>();
  for (const row of eventRows) {
    const list = bySubmission.get(row.submission_id) ?? [];
    list.push(toEvent(row));
    bySubmission.set(row.submission_id, list);
  }

  return rows.map((row) => ({
    ...toSubmission(row),
    events: bySubmission.get(row.id) ?? [],
  }));
}

export async function getSubmission(
  id: string,
): Promise<VerifierSubmission | null> {
  const rows = (await sql`
    SELECT * FROM verifier_submissions WHERE id = ${id} LIMIT 1
  `) as SubmissionRow[];
  return rows[0] ? toSubmission(rows[0]) : null;
}

export async function listEvents(
  submissionId: string,
): Promise<SubmissionEvent[]> {
  const rows = (await sql`
    SELECT * FROM submission_events
    WHERE submission_id = ${submissionId}
    ORDER BY created_at ASC
  `) as EventRow[];
  return rows.map(toEvent);
}

/**
 * Escribe una fila en la bitácora. Append-only a propósito: ninguna ruta
 * la edita ni la borra, porque es el registro de quién revisó qué.
 */
export async function appendEvent(input: {
  submissionId: string;
  kind: SubmissionEventKind;
  actor: string;
  actorRole: SubmissionEvent["actorRole"];
  detail?: string | null;
}): Promise<SubmissionEvent> {
  const rows = (await sql`
    INSERT INTO submission_events (submission_id, kind, actor, actor_role, detail)
    VALUES (${input.submissionId}, ${input.kind}, ${input.actor}, ${input.actorRole}, ${input.detail ?? null})
    RETURNING *
  `) as EventRow[];
  return toEvent(rows[0]);
}

export async function createSubmission(
  input: CreateSubmissionInput,
): Promise<VerifierSubmission> {
  const rows = (await sql`
    INSERT INTO verifier_submissions
      (company_name, company_ruc, company_wallet, sector, city, years_operating,
       annual_revenue, project_title, project_type, use_of_funds, requested_amount,
       term_months, collateral_kind, collateral_value, collateral_detail,
       legal_pack_hash, legal_pack_name)
    VALUES
      (${input.companyName}, ${input.companyRuc}, ${input.companyWallet},
       ${input.sector}, ${input.city}, ${input.yearsOperating},
       ${input.annualRevenue}, ${input.projectTitle}, ${input.projectType},
       ${input.useOfFunds}, ${input.requestedAmount}, ${input.termMonths},
       ${input.collateralKind}, ${input.collateralValue}, ${input.collateralDetail},
       ${input.legalPackHash}, ${input.legalPackName})
    RETURNING *
  `) as SubmissionRow[];

  const submission = toSubmission(rows[0]);

  // El primer evento de la bitácora lo escribe la propia creación: si el
  // seguimiento empezara recién con la primera acción del verificador,
  // la empresa vería una historia que arranca sin su propio envío.
  await appendEvent({
    submissionId: submission.id,
    kind: "submitted",
    actor: submission.companyWallet,
    actorRole: "business",
    detail: null,
  });

  return submission;
}

/**
 * Un verificador toma el expediente. No es un trámite decorativo: es lo
 * que convierte "En cola" en "alguien concreto lo está mirando desde tal
 * hora", que era la pregunta sin respuesta del dueño del negocio.
 *
 * Solo se puede tomar lo que está en cola — reclamar un expediente ya
 * tomado devuelve null y la ruta responde 409.
 */
export async function claimSubmission(
  id: string,
  reviewer: string,
): Promise<VerifierSubmission | null> {
  const rows = (await sql`
    UPDATE verifier_submissions
    SET status = 'in_review',
        reviewer = ${reviewer},
        review_started_at = now()
    WHERE id = ${id} AND status = 'pending'
    RETURNING *
  `) as SubmissionRow[];

  if (!rows[0]) return null;

  await appendEvent({
    submissionId: id,
    kind: "claimed",
    actor: reviewer,
    actorRole: "verifier",
    detail: null,
  });

  return toSubmission(rows[0]);
}

export async function decideSubmission(
  id: string,
  decision: DecisionInput,
): Promise<VerifierSubmission | null> {
  const status: SubmissionStatus = decision.approve ? "approved" : "rejected";
  const passport = decision.passport;
  const rows = (await sql`
    UPDATE verifier_submissions
    SET status = ${status},
        decided_at = now(),
        decided_by = ${decision.decidedBy},
        reviewer = COALESCE(reviewer, ${decision.decidedBy}),
        note = ${decision.note ?? null},
        passport_tx_hash = ${passport?.txHash ?? null},
        passport_token_id = ${passport?.tokenId ?? null},
        passport_chain_id = ${passport?.chainId ?? null},
        passport_contract_address = ${passport?.contractAddress ?? null},
        onchain_synced_at = ${passport ? new Date().toISOString() : null}
    WHERE id = ${id}
    RETURNING *
  `) as SubmissionRow[];

  if (!rows[0]) return null;

  await appendEvent({
    submissionId: id,
    kind: decision.approve ? "approved" : "rejected",
    actor: decision.decidedBy,
    actorRole: "verifier",
    detail: decision.note ?? null,
  });

  return toSubmission(rows[0]);
}

export async function getPublicCompanyEvidence(
  wallet: string,
): Promise<PublicCompanyEvidence | null> {
  const rows = (await sql`
    SELECT company_name,
           company_ruc,
           legal_pack_hash,
           status,
           decided_by,
           decided_at,
           passport_tx_hash
    FROM verifier_submissions
    WHERE lower(company_wallet) = lower(${wallet})
    ORDER BY submitted_at DESC
    LIMIT 1
  `) as Array<
    Pick<
      SubmissionRow,
      | "company_name"
      | "company_ruc"
      | "legal_pack_hash"
      | "status"
      | "decided_by"
      | "decided_at"
      | "passport_tx_hash"
    >
  >;
  const row = rows[0];
  if (!row) return null;

  return {
    companyName: row.company_name,
    companyRuc: row.company_ruc,
    legalPackHash: row.legal_pack_hash,
    verificationStatus: row.status,
    verifier: row.decided_by,
    lastReviewedAt: row.decided_at,
    onchainTxHash: row.passport_tx_hash,
  };
}
