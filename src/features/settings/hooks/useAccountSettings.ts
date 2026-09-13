import { useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { authApi, messageOf } from "@/api";
import { useSessionStore } from "@/stores/session.store";
import { useUiStore } from "@/stores/ui.store";

/** 账户区逻辑：按平台断开账号 + 完整登出 */
export function useAccountSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reset = useSessionStore((s) => s.reset);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 断开单个平台：只清除该平台凭证，不触碰仓库绑定 */
  async function disconnect(providerId: string) {
    setBusyProvider(providerId);
    setError(null);
    try {
      await authApi.logout(providerId);
      await queryClient.invalidateQueries({ queryKey: ["auth-status"] });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusyProvider(null);
    }
  }

  /** 完整登出：清除全部平台凭证与本地配置（含仓库绑定） */
  async function logoutAll() {
    setLoggingOut(true);
    setError(null);
    try {
      await authApi.logout();
      reset();
      closeSettings();
      navigate("/setup", { replace: true });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoggingOut(false);
    }
  }

  /** 补登录成功后刷新平台状态 */
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["auth-status"] });
  }

  return { disconnect, logoutAll, refresh, busyProvider, loggingOut, error };
}
