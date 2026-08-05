import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  CreateSubmissionInput,
  DecisionInput,
  VerifierSubmission,
} from "./types";

/**
 * Storage TEMPORAL — archivo JSON local, mientras Supabase no está
 * conectado (ver conversación de arquitectura, agosto 2026). Las cuatro
 * funciones de abajo son el contrato completo que usan las rutas API;
 * cuando Supabase esté listo, este archivo se reemplaza entero por
 * queries a una tabla `verifier_submissions` con la misma forma —
 * ninguna ruta debería cambiar.
 *
 * NO usar en producción: escritura no atómica, sin locking, se pierde
 * si el proceso corre en un entorno serverless sin filesystem persistente.
 */
const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "verifier-submissions.json");

async function readAll(): Promise<VerifierSubmission[]> {
  try {
    const raw = await readFile(FILE, "utf-8");
    return JSON.parse(raw) as VerifierSubmission[];
  } catch {
    return [];
  }
}

async function writeAll(submissions: VerifierSubmission[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(submissions, null, 2), "utf-8");
}

export async function listSubmissions(): Promise<VerifierSubmission[]> {
  const all = await readAll();
  return all.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export async function createSubmission(
  input: CreateSubmissionInput,
): Promise<VerifierSubmission> {
  const all = await readAll();
  const submission: VerifierSubmission = {
    ...input,
    id: randomUUID(),
    status: "pending",
    submittedAt: new Date().toISOString(),
    decidedAt: null,
    decidedBy: null,
    note: null,
  };
  all.push(submission);
  await writeAll(all);
  return submission;
}

export async function decideSubmission(
  id: string,
  decision: DecisionInput,
): Promise<VerifierSubmission | null> {
  const all = await readAll();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return null;

  const updated: VerifierSubmission = {
    ...all[idx],
    status: decision.approve ? "approved" : "rejected",
    decidedAt: new Date().toISOString(),
    decidedBy: decision.decidedBy,
    note: decision.note ?? null,
  };
  all[idx] = updated;
  await writeAll(all);

  // TODO cuando exista IdentityRegistry: si approve, llamar
  // setEligible(updated.companyWallet, true) acá — el expediente ya
  // trae la wallet, solo falta el contrato.
  return updated;
}
