import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiApi } from "@/api";
import type { AiSettings } from "@/api";

/** AI 配置（服务端/Git 态，TanStack Query 权威来源） */
export function useAiConfig() {
  return useQuery({
    queryKey: ["ai-config"],
    queryFn: () => aiApi.getConfig(),
    staleTime: 60_000,
  });
}

export function useSaveAiConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      settings,
      apiKeys,
    }: { settings: AiSettings; apiKeys: { providerId: string; key: string }[] }) =>
      aiApi.saveConfig(settings, apiKeys),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["ai-config"] }),
  });
}
