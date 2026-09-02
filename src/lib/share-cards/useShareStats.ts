import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccess } from "@/lib/use-access";
import { getShareStats } from "@/lib/share-cards/share-stats.functions";
import type { ShareData, ShareTemplateId } from "@/lib/share-cards/renderer";

export type UseShareStatsResult = {
  data: ShareData;
  availableTemplates: ShareTemplateId[];
  isLoading: boolean;
  refresh: () => Promise<unknown>;
};

/**
 * Puxa dados reais do usuário para os cards de compartilhamento.
 * Não inventa números: se um dado não existir, o campo fica undefined
 * e o template correspondente é omitido da lista de disponíveis.
 */
export function useShareStats(): UseShareStatsResult {
  const { userId } = useAccess();

  const query = useQuery({
    queryKey: ["share-stats", userId],
    queryFn: () => getShareStats(),
    enabled: !!userId,
    staleTime: 0,
    gcTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const refresh = useCallback(() => query.refetch(), [query]);

  return useMemo<UseShareStatsResult>(() => {
    const s = query.data;

    const data: ShareData = {
      level: s ? { name: s.level.name } : undefined,
      field: s?.field ?? undefined,
      phrase: s?.level.phrase,
      streak: s?.streak,
      missionsTotal: s && s.missionsTotal > 0 ? s.missionsTotal : undefined,
      missionsWeek: s && s.missionsWeek > 0 ? s.missionsWeek : undefined,
      checkinsWeek: s && s.checkinsWeek > 0 ? s.checkinsWeek : undefined,
    };

    const available: ShareTemplateId[] = [];
    if (s) {
      if (s.missionsWeek > 0) available.push("checkin");
      if (s.streak > 0) available.push("streak");
      available.push("level");
      if (s.missionsWeek > 0 || s.checkinsWeek > 0) available.push("week");
    } else {
      available.push("level");
    }

    return {
      data,
      availableTemplates: available,
      isLoading: query.isLoading,
      refresh,
    };
  }, [query.data, query.isLoading, refresh]);
}
