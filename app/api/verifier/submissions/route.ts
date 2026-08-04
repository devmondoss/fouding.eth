import { NextResponse } from "next/server";
import { createSubmission, listSubmissions } from "@/lib/verifier/store";
import type { CreateSubmissionInput } from "@/lib/verifier/types";

export async function GET() {
  const submissions = await listSubmissions();
  return NextResponse.json(submissions);
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<CreateSubmissionInput>;

  if (!body.companyName || !body.projectTitle || !body.requestedAmount) {
    return NextResponse.json(
      { error: "companyName, projectTitle y requestedAmount son obligatorios" },
      { status: 400 },
    );
  }

  const submission = await createSubmission({
    companyName: body.companyName,
    companyRuc: body.companyRuc ?? "",
    projectTitle: body.projectTitle,
    requestedAmount: body.requestedAmount,
    legalPackHash: body.legalPackHash ?? "",
  });

  return NextResponse.json(submission, { status: 201 });
}
