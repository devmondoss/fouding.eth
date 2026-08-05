import { NextResponse } from "next/server";
import { requireVerifierAuth } from "@/lib/verifier/auth";
import { withDbErrors } from "@/lib/verifier/apiError";
import { createSubmission, listSubmissions } from "@/lib/verifier/store";
import type { CreateSubmissionInput } from "@/lib/verifier/types";

export async function GET(req: Request) {
  const denied = await requireVerifierAuth(req);
  if (denied) return denied;

  return withDbErrors(async () => {
    const submissions = await listSubmissions();
    return NextResponse.json(submissions);
  });
}

export async function POST(req: Request) {
  const denied = await requireVerifierAuth(req);
  if (denied) return denied;

  const body = (await req.json()) as Partial<CreateSubmissionInput>;

  if (
    !body.companyName ||
    !body.companyWallet ||
    !body.projectTitle ||
    !body.requestedAmount
  ) {
    return NextResponse.json(
      {
        error:
          "companyName, companyWallet, projectTitle y requestedAmount son obligatorios",
      },
      { status: 400 },
    );
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(body.companyWallet)) {
    return NextResponse.json(
      { error: "companyWallet no tiene forma de dirección EVM (0x...)" },
      { status: 400 },
    );
  }

  return withDbErrors(async () => {
    const submission = await createSubmission({
      companyName: body.companyName!,
      companyRuc: body.companyRuc ?? "",
      companyWallet: body.companyWallet!,
      projectTitle: body.projectTitle!,
      requestedAmount: body.requestedAmount!,
      legalPackHash: body.legalPackHash ?? "",
    });

    return NextResponse.json(submission, { status: 201 });
  });
}
