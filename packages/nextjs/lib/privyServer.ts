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
