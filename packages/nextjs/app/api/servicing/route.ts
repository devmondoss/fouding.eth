import { NextResponse } from "next/server";
import { requireVerifierAuth } from "@/lib/verifier/auth";
import {
  ACTIONS_BY_STATUS,
  getVaultState,
  runVaultAction,
  type VaultAction,
} from "@/lib/servicing/onchain";

/**
 * Estado del crédito y sus transiciones. Protegida con la API key del
 * panel: son operaciones de administración, no del inversionista.
 */
export async function GET(req: Request) {
  const denied = await requireVerifierAuth(req);
  if (denied) return denied;

  try {
    return NextResponse.json(await getVaultState());
  } catch (err) {
    console.error("[servicing] no se pudo leer el vault:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo leer el vault" },
      { status: 503 },
    );
  }
}

export async function POST(req: Request) {
  const denied = await requireVerifierAuth(req);
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as {
    action?: VaultAction;
    amount?: string;
  } | null;

  if (!body?.action) {
    return NextResponse.json({ error: "action es obligatorio" }, { status: 400 });
  }
  if (body.amount !== undefined && !/^\d+$/.test(body.amount)) {
    return NextResponse.json(
      { error: "amount debe ser un entero en micro-USDC" },
      { status: 400 },
    );
  }

  try {
    // Se revalida contra el estado ACTUAL, no contra lo que el panel creía
    // al pintarse: entre que se cargó la pantalla y se apretó el botón, el
    // crédito pudo haber cambiado de estado.
    const state = await getVaultState();
    const allowed = ACTIONS_BY_STATUS[state.status] ?? [];
    if (!allowed.includes(body.action)) {
      return NextResponse.json(
        {
          error: `No se puede "${body.action}" desde el estado "${state.statusLabel}"`,
        },
        { status: 409 },
      );
    }

    const hash = await runVaultAction(
      body.action,
      body.amount ? BigInt(body.amount) : undefined,
    );
    return NextResponse.json({ ok: true, hash, state: await getVaultState() });
  } catch (err) {
    console.error("[servicing] la acción falló:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "La operación falló" },
      { status: 502 },
    );
  }
}
