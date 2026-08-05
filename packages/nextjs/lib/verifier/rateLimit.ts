import { sql } from "../db/client";

/**
 * Rate limiting de ventana fija, por IP, respaldado en Postgres — un
 * Map en memoria no sirve porque cada invocación serverless puede
 * correr en una instancia distinta. Solo protege las rutas del
 * verificador, que hoy comparten una sola API key entre todos los
 * clientes (ver auth.ts); limitar por key no serviría de nada.
 */
const WINDOW_MS = 60_000; // 1 minuto
const MAX_REQUESTS_PER_WINDOW = 30;

export async function isRateLimited(ip: string): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS);

  const rows = (await sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${ip}, ${windowStart.toISOString()}, 1)
    ON CONFLICT (key, window_start)
    DO UPDATE SET count = rate_limits.count + 1
    RETURNING count
  `) as { count: number }[];

  return (rows[0]?.count ?? 1) > MAX_REQUESTS_PER_WINDOW;
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
