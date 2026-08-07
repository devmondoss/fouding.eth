"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import type { PublicCompanyEvidence } from "@/lib/verifier/types";

export function useCompanyEvidence(wallet?: Address) {
  const query = useQuery({
    queryKey: ["company-evidence", wallet],
    enabled: Boolean(wallet),
    retry: 1,
    queryFn: async (): Promise<PublicCompanyEvidence | null> => {
      const response = await fetch(`/api/company-evidence/${wallet}`, {
        cache: "no-store",
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("No se pudo consultar la evidencia");
      return (await response.json()) as PublicCompanyEvidence;
    },
  });

  return {
    evidence: query.data ?? null,
    isLoading: Boolean(wallet) && query.isPending,
    error: query.error,
    refetch: query.refetch,
  };
}
