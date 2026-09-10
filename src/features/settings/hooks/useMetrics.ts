import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { metricsApi } from "@/api";

/** 本机指标快照的查询键（服务端状态唯一权威来源）。 */
export const metricsKey = ["metrics", "snapshot"] as const;

/** 首次打开设置时的一次性说明是否已读（本机 localStorage，不进笔记库）。 */
const NOTICE_SEEN_KEY = "ainote.metrics-notice-seen";

export function useMetricsSnapshot() {
  return useQuery({
    queryKey: metricsKey,
    queryFn: () => metricsApi.read(),
    staleTime: 15_000,
  });
}

/** 切换本地计数开关；成功后刷新快照状态。 */
export function useSetMetricsEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => metricsApi.setEnabled(enabled),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: metricsKey }),
  });
}

/** 清空本机指标（用户主动操作）。 */
export function useClearMetrics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => metricsApi.clear(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: metricsKey }),
  });
}

/** 首次打开设置时展示的说明；localStorage 不可用时视为已读（不反复打扰）。 */
export function useMetricsNotice() {
  const [visible, setVisible] = useState(() => !hasSeenMetricsNotice());
  return {
    visible,
    dismiss: () => {
      markMetricsNoticeSeen();
      setVisible(false);
    },
  };
}

export function hasSeenMetricsNotice(): boolean {
  try {
    return globalThis.localStorage?.getItem(NOTICE_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markMetricsNoticeSeen(): void {
  try {
    globalThis.localStorage?.setItem(NOTICE_SEEN_KEY, "1");
  } catch {
    // 记忆失败只影响下次是否再提示，不影响开关本身
  }
}
