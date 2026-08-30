import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/api";

/** 启动时认证与绑定状态（路由守卫用） */
export function useAuthStatusQuery() {
  return useQuery({
    queryKey: ["auth-status"],
    queryFn: () => authApi.status(),
    retry: false,
  });
}
