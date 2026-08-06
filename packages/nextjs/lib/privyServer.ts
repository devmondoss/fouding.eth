import { PrivyClient } from "@privy-io/server-auth";

let client: PrivyClient | null = null;

/**
 * Cliente de servidor de Privy — separado del SDK de cliente
 * (@privy-io/react-auth) porque necesita el App Secret, que nunca debe
 * llegar al navegador. Solo lo usan rutas backend (ver
 * app/api/account/delete).
 */
export function getPrivyServerClient(): PrivyClient | null {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) return null;
  if (!client) client = new PrivyClient(appId, appSecret);
  return client;
}

/**
 * Dirección de la wallet de quien hace la request, sacada de su token de
 * Privy — nunca del body.
 *
 * Existe porque crear un expediente aceptaba `companyWallet` como dato
 * suelto: cualquiera podía mandar solicitudes a nombre de la wallet de
 * otra empresa, y esa wallet es justo la que el IdentityRegistry habilita
 * si el expediente se aprueba.
 *
 * Devuelve null si no hay token, si es inválido o si el entorno no tiene
 * PRIVY_APP_SECRET — quien llama decide el código de error.
 */
export async function getAuthenticatedWallet(
  req: Request,
): Promise<string | null> {
  const c = getPrivyServerClient();
  if (!c) return null;

  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  try {
    const claims = await c.verifyAuthToken(token);
    const user = await c.getUser(claims.userId);
    return user.wallet?.address ?? null;
  } catch {
    return null;
  }
}
