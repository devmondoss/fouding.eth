import { sql } from "../db/client";

/**
 * Rate limiting de ventana fija, por IP, respaldado en Postgres — un
 * Map en memoria no sirve porque cada invocación serverless puede
 * correr en una instancia distinta. `scope` separa el balde de las
 * rutas protegidas por API key (ver auth.ts) del de las rutas
 * públicas de solicitud (app/solicitar) — comparten IP pero no deben
 * compartir contador.
 */
const WINDOW_MS = 60_000; // 1 minuto

export async function isRateLimited(
  ip: string,
  { scope = "auth", limit = 30 }: { scope?: string; limit?: number } = {},
): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS);
  const key = `${scope}:${ip}`;

  const rows = (await sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, ${windowStart.toISOString()}, 1)
    ON CONFLICT (key, window_start)
    DO UPDATE SET count = rate_limits.count + 1
    RETURNING count
  `) as { count: number }[];

  return (rows[0]?.count ?? 1) > limit;
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
