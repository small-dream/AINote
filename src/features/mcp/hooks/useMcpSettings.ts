import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mcpApi } from "@/api";
import type { McpAction } from "@/api";

export const mcpKeys = {
  status: ["mcp-status"] as const,
};

/** MCP 设置查询与三个管理动作；成功后直接写回状态缓存，避免额外往返。 */
export function useMcpSettings() {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: mcpKeys.status,
    queryFn: () => mcpApi.status(),
    retry: false,
  });
  const apply = (action: McpAction) => {
    queryClient.setQueryData(mcpKeys.status, action.status);
  };
  const setEnabled = useMutation({
    mutationFn: ({ enabled, port }: { enabled: boolean; port?: number }) =>
      mcpApi.setEnabled(enabled, port),
    onSuccess: apply,
  });
  const setPort = useMutation({
    mutationFn: (port: number) => mcpApi.setPort(port),
    onSuccess: apply,
  });
  const rotateToken = useMutation({
    mutationFn: () => mcpApi.rotateToken(),
    onSuccess: apply,
  });
  return { status, setEnabled, setPort, rotateToken };
}
