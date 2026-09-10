import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supportApi } from "@/api";

/** 诊断与反馈运行信息的查询键（服务端状态唯一权威来源）。 */
export const supportInfoKey = ["support", "info"] as const;

/** 读取日志目录、开关与占用。 */
export function useSupportInfo() {
  return useQuery({
    queryKey: supportInfoKey,
    queryFn: () => supportApi.info(),
    staleTime: 15_000,
  });
}

/** 切换本地日志开关；成功后刷新占用信息。 */
export function useSetLoggingEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => supportApi.setLoggingEnabled(enabled),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: supportInfoKey }),
  });
}

/** 清理本地日志，返回释放字节数；成功后刷新占用信息。 */
export function useClearLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => supportApi.clearLogs(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: supportInfoKey }),
  });
}
