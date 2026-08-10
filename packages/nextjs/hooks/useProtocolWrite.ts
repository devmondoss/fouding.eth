"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Abi, Address } from "viem";
import { useConfig, useWriteContract } from "wagmi";
import {
  getAccount,
  simulateContract,
  waitForTransactionReceipt,
} from "wagmi/actions";
import { protocolChain } from "@/lib/web3/config";

type ProtocolWrite = {
  address: Address;
  abi: Abi;
  account: Address;
  functionName: string;
  args?: readonly unknown[];
};

/**
 * Cuánto se espera a que wagmi reconozca la wallet. En una cuenta recién
 * creada el puente tarda un par de segundos; si a los veinte no la tiene,
 * no es una demora, es otra cosa.
 */
const SINCRONIA_TIMEOUT_MS = 20_000;

/**
 * Espera a que el conector de wagmi conozca ESTA cuenta antes de firmar.
 *
 * La dirección se lee de Privy, que la sabe apenas crea la wallet
 * embebida; el conector de wagmi la aprende después, por el puente de
 * @privy-io/wagmi. En una sesión ya establecida la diferencia no se nota,
 * pero al registrarse son los mismos segundos en los que la app dispara
 * sola la recarga de saldo de prueba — y wagmi contestaba con
 * `Account "0x…" not found for connector "Privy Wallet"`, un mensaje de
 * librería que terminaba impreso, en inglés, dentro de un cartel rojo
 * como primera impresión del producto.
 *
 * No es un error: es llegar temprano. Se espera.
 */
async function esperarWallet(
  config: ReturnType<typeof useConfig>,
  account: Address,
): Promise<void> {
  const objetivo = account.toLowerCase();
  const limite = Date.now() + SINCRONIA_TIMEOUT_MS;

  for (;;) {
    const cuenta = getAccount(config);
    const laTiene = cuenta.addresses?.some((a) => a.toLowerCase() === objetivo);
    if (cuenta.status === "connected" && laTiene) return;

    if (Date.now() > limite) {
      throw new Error(
        cuenta.status === "connected"
          ? "Tu wallet conectada es otra. Vuelve a entrar con la cuenta correcta."
          : "Tu wallet todavía no terminó de conectarse. Espera unos segundos y vuelve a intentar.",
      );
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

export function useProtocolWrite() {
  const config = useConfig();
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const [isConfirming, setIsConfirming] = useState(false);

  const writeAndConfirm = useCallback(
    async (write: ProtocolWrite) => {
      setIsConfirming(true);
      try {
        // Antes de simular: la simulación misma pide un cliente para esta
        // cuenta, así que sin esto la carrera reventaba una línea más
        // abajo y con el mensaje de la librería.
        await esperarWallet(config, write.account);

        const simulation = await simulateContract(config, {
          ...write,
          chainId: protocolChain.id,
        } as never);
        const hash = await writeContractAsync(simulation.request as never);
        const receipt = await waitForTransactionReceipt(config, {
          chainId: protocolChain.id,
          hash,
        });
        if (receipt.status !== "success") {
          throw new Error(`Transaction reverted: ${hash}`);
        }
        await queryClient.invalidateQueries({
          predicate: query => query.queryKey[0] === "readContract",
        });
        return receipt;
      } finally {
        setIsConfirming(false);
      }
    },
    [config, queryClient, writeContractAsync],
  );

  return { writeAndConfirm, isConfirming };
}
