"use client";

import type { Address } from "viem";
import { useProtocolToken } from "@/hooks/useProtocolToken";
import { usePlatform } from "@/lib/data/store";
import { useSession } from "@/lib/useSession";

/**
 * El saldo, de una sola fuente.
 *
 * Había tres: la barra superior leía el saldo proyectado en localStorage,
 * el panel de inversión leía el de la cadena (`token.balance ?? balance`)
 * y la pantalla de fondos mezclaba los dos según el modo. Con una wallet
 * que ya tenía 10 000 mUSDC en cadena, la barra decía 0 y el panel decía
 * 10 000 — la misma pantalla contradiciéndose.
 *
 * La regla queda en un solo lugar: si hay token desplegado en esta red,
 * la verdad es la cadena; si no lo hay, el producto está en modo
 * simulación y la verdad es el saldo local. Y el rótulo acompaña — un
 * token de prueba nunca se llama "USDC" a secas (PRODUCT.md §Evidence).
 */
export function useSaldo() {
  const { session } = useSession();
  const { balance: local } = usePlatform();
  const token = useProtocolToken(session?.address as Address | undefined);

  const onchain = Boolean(token.address && session?.address);

  return {
    /** Saldo a mostrar, en micro-unidades. */
    value: onchain ? (token.balance ?? 0n) : local,
    symbol: onchain ? token.symbol : "USDC",
    /** Si la cifra viene de la cadena o del saldo simulado. */
    onchain,
    /** Todavía no se leyó la cadena: la cifra aún no significa nada. */
    isLoading: onchain && token.balance === undefined,
    refetch: token.refetch,
  };
}
