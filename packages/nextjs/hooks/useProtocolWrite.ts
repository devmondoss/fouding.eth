"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Abi, Address } from "viem";
import { useConfig, useWriteContract } from "wagmi";
import { simulateContract, waitForTransactionReceipt } from "wagmi/actions";
import { protocolChain } from "@/lib/web3/config";

type ProtocolWrite = {
  address: Address;
  abi: Abi;
  account: Address;
  functionName: string;
  args?: readonly unknown[];
};

export function useProtocolWrite() {
  const config = useConfig();
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const [isConfirming, setIsConfirming] = useState(false);

  const writeAndConfirm = useCallback(
    async (write: ProtocolWrite) => {
      setIsConfirming(true);
      try {
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
