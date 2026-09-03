import { useQuery } from "@tanstack/react-query";
import { aiApi, messageOf } from "@/api";
import type { AiProvider } from "@/api";

interface AiRemoteModelsParams {
  providerId: string;
  baseUrl: string;
  provider: AiProvider;
}

/** 弹窗内按需拉取远程模型；不随草稿输入自动请求。 */
export function useAiRemoteModels(params: AiRemoteModelsParams) {
  const query = useQuery({
    queryKey: ["ai-remote-models", params.providerId, params.provider, params.baseUrl],
    queryFn: () => aiApi.fetchModels(params.providerId, params.baseUrl, params.provider),
    enabled: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    remoteModels: query.data ?? [],
    fetchError: query.error ? messageOf(query.error) : null,
    isFetching: query.isFetching,
    fetchModels: () => void query.refetch(),
  };
}
