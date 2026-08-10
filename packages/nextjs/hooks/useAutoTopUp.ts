"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { useSession } from "@/lib/useSession";
import { useProtocolToken } from "@/hooks/useProtocolToken";
import { mensajeDeCadena } from "@/lib/web3/errors";
import { TOPUP_TOKEN_AMOUNT, type TopUpResult, type TopUpStatus } from "@/lib/faucet/config";

/**
 * Recarga de prueba automática al entrar.
 *
 * El primer contacto con el producto era una wallet en cero y una
 * pantalla que pedía "envía USDC a esta dirección desde otra wallet":
 * para probar el producto había que salir del producto. Ahora, si la
 * sesión existe y la wallet está vacía, se pide el goteo solo, una vez,
 * sin que nadie apriete nada.
 *
 * Se dispara UNA vez por wallet y por pestaña (`sessionStorage`): si
 * alguien se gasta todo invirtiendo, no queremos que la app le vuelva a
 * regalar saldo sin que lo pida — para eso está `topUp()` manual.
 */

export type AutoTopUpPhase = "idle" | "checking" | "loading" | "done" | "error";

const doneKey = (wallet: string) => `founding.topup.${wallet.toLowerCase()}`;

/** Lo que se espera a que el navegador firme antes de darlo por perdido.
 * Una transacción en Arbitrum Sepolia se confirma en segundos; si a los
 * 45 no salió, no va a salir. */
const SELF_CLAIM_TIMEOUT_MS = 45_000;
/** Ídem para la llamada al servidor, que a su vez espera receipts. */
const REQUEST_TIMEOUT_MS = 90_000;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (cause) => {
        clearTimeout(timer);
        reject(cause);
      },
    );
  });
}

/**
 * `auto: false` para las superficies que solo quieren el botón manual y
 * el estado (AddFundsFlow): el goteo automático lo dispara una sola
 * pieza —el aviso del shell—, o dos componentes montados a la vez
 * pedirían lo mismo dos veces.
 */
export function useAutoTopUp({ auto = true }: { auto?: boolean } = {}) {
  const { session, getAccessToken } = useSession();
  const wallet = session?.address ?? null;
  const token = useProtocolToken(wallet as Address | undefined);
  /* `useProtocolToken` devuelve un objeto nuevo en cada render, así que
     no puede ser dependencia de `topUp` sin recrearla siempre — y como
     el efecto depende de `topUp`, eso sería un bucle. Solo hace falta la
     última versión de la función al momento de llamarla, y el ref se
     actualiza en un efecto porque escribirlo en render no es puro. */
  const claimRef = useRef(token.faucet);
  useEffect(() => {
    claimRef.current = token.faucet;
  });

  const [phase, setPhase] = useState<AutoTopUpPhase>("idle");
  const [status, setStatus] = useState<TopUpStatus | null>(null);
  const [result, setResult] = useState<TopUpResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Evita dos goteos en vuelo si el componente se re-monta. */
  const running = useRef(false);

  const topUp = useCallback(async (): Promise<TopUpResult | null> => {
    if (running.current) return null;
    running.current = true;
    setPhase("loading");
    setError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Tu sesión expiró, vuelve a entrar");

      const res = await withTimeout(
        fetch("/api/faucet", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        REQUEST_TIMEOUT_MS,
        "La recarga tardó demasiado",
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "No se pudo recargar");

      let dripped = body as TopUpResult;

      // Segunda mitad: la dispensadora no podía emitir el token, pero
      // mandó el gas, así que ahora ESTA wallet puede reclamarlo sola
      // del contrato. Se firma acá porque la llave es del usuario, no
      // del servidor.
      if (dripped.selfClaim) {
        // Con tope. `writeContractAsync` de wagmi puede no resolver NUNCA
        // —conector que no soporta la red, wallet que no termina de
        // conectar, modal de firma que no aparece— y una promesa colgada
        // acá deja la pantalla de arranque esperando para siempre, que es
        // exactamente lo que pasó: gas acreditado, firma jamás enviada.
        await withTimeout(
          claimRef.current(),
          SELF_CLAIM_TIMEOUT_MS,
          "Tu wallet no llegó a firmar el reclamo del saldo",
        );
        dripped = {
          ...dripped,
          granted: { ...dripped.granted, token: true },
          selfClaim: false,
          balance: {
            ...dripped.balance,
            token: dripped.balance.token + TOPUP_TOKEN_AMOUNT,
          },
          message: `Listo: ${TOPUP_TOKEN_AMOUNT.toLocaleString("es-PE")} mUSDC de prueba en tu wallet`,
        };
      }

      setResult(dripped);
      setPhase("done");
      return dripped;
    } catch (cause) {
      setError(mensajeDeCadena(cause, "No se pudo recargar tu saldo de prueba."));
      setPhase("error");
      return null;
    } finally {
      running.current = false;
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!wallet) return;
    if (!auto) {
      // Sin goteo automático igual interesa el estado: es lo que le
      // permite a AddFundsFlow decir si la dispensadora está viva.
      let alive = true;
      (async () => {
        const accessToken = await getAccessToken();
        if (!accessToken || !alive) return;
        const res = await fetch("/api/faucet", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (alive && res.ok) setStatus((await res.json()) as TopUpStatus);
      })().catch(() => {});
      return () => {
        alive = false;
      };
    }
    if (window.sessionStorage.getItem(doneKey(wallet))) return;

    let alive = true;

    (async () => {
      setPhase("checking");
      try {
        const accessToken = await getAccessToken();
        if (!accessToken || !alive) return;

        // Se consulta antes de gotear: si la wallet ya tiene saldo, no
        // se manda ninguna transacción ni se gasta gas del operador.
        const res = await fetch("/api/faucet", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const current = (await res.json()) as TopUpStatus;
        if (!alive) return;
        setStatus(current);

        if (!current.available || !current.needsTopUp) {
          setPhase("idle");
          return;
        }

        window.sessionStorage.setItem(doneKey(wallet), "1");
        await topUp();
      } catch {
        if (alive) setPhase("idle");
      }
    })();

    return () => {
      alive = false;
    };
  }, [wallet, auto, getAccessToken, topUp]);

  return { phase, status, result, error, topUp };
}
