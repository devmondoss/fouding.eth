/** Formateo. Toda cifra que se muestre pasa por acá. */

/** Helper de autoría: usdc(1500) -> 1_500_000_000n */
export function usdc(amount: number): bigint {
  return BigInt(Math.round(amount * 1e6));
}

export function toNumber(v: bigint): number {
  return Number(v) / 1e6;
}

const nf = (max: number) =>
  new Intl.NumberFormat("es-PE", {
    maximumFractionDigits: max,
    minimumFractionDigits: 0,
  });

export function formatUsdc(v: bigint, decimals = 0): string {
  return nf(decimals).format(toNumber(v));
}

export function formatUsdcCompact(v: bigint): string {
  const n = toNumber(v);
  if (n >= 1_000_000) return `${nf(2).format(n / 1_000_000)}M`;
  if (n >= 1_000) return `${nf(0).format(n / 1_000)}k`;
  return nf(0).format(n);
}

export function formatBps(bps: number, decimals?: number): string {
  const pct = bps / 100;
  const d = decimals ?? (Number.isInteger(pct) ? 0 : 1);
  return `${pct.toFixed(d)}%`;
}

/** Coverage ratio: 16200 bps -> "1.62x" */
export function formatRatio(bps: number): string {
  return `${(bps / 10000).toFixed(2)}x`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function daysUntil(iso: string, from = "2026-08-03"): number {
  const ms = new Date(iso).getTime() - new Date(from).getTime();
  return Math.ceil(ms / 86_400_000);
}

/** "hace 3 minutos" / "hace 2 horas" / "hace 5 días" — a diferencia de
 * daysUntil() (fecha fija, para el mock del deck) esto usa la hora
 * real: es para timestamps reales como la wallet recién conectada. */
export function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(ms / 60_000));

  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} ${hours === 1 ? "hora" : "horas"}`;

  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

export function shortHash(hash: string, size = 6): string {
  if (hash.length <= size * 2 + 2) return hash;
  return `${hash.slice(0, size + 2)}…${hash.slice(-size)}`;
}
