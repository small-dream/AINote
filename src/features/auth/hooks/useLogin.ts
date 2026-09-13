import { useState } from "react";
import { authApi, messageOf } from "@/api";
import { useSessionStore } from "@/stores/session.store";

interface UseLoginOptions {
  /** 固定平台（设置页补登录）：不提供切换 */
  fixedProviderId?: string | undefined;
  /** 默认选中的平台 id */
  defaultProviderId?: string | undefined;
}

/** 登录流程编排：按平台校验令牌 → 保存到本地安全存储 */
export function useLogin(
  onSuccess: (result: { login: string; providerId: string }) => void,
  options: UseLoginOptions = {}
) {
  const setLogin = useSessionStore((s) => s.setLogin);
  const [providerId, setProviderId] = useState(options.fixedProviderId ?? options.defaultProviderId ?? "github");
  const [token, setToken] = useState("");
  const [login, setLoginName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleValidate() {
    if (!token.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setLoginName((await authApi.validateToken(providerId, token.trim())).login);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!login) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.saveToken(providerId, token.trim(), login);
      setLogin(login);
      onSuccess({ login, providerId });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  function onTokenChange(value: string) {
    setToken(value);
    setError(null);
    setLoginName(null);
  }

  /** 切换平台：清空上一次的输入与校验结果，避免把凭证存到错误平台 */
  function selectProvider(id: string) {
    if (options.fixedProviderId || id === providerId) return;
    setProviderId(id);
    setToken("");
    setLoginName(null);
    setError(null);
  }

  return {
    providerId,
    token,
    login,
    error,
    busy,
    selectProvider,
    handleValidate,
    handleSave,
    onTokenChange,
  };
}
