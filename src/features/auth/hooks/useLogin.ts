import { useState } from "react";
import { authApi, messageOf } from "@/api";
import { useSessionStore } from "@/stores/session.store";

/** GitHub 登录流程编排：校验 token → 保存到钥匙串 */
export function useLogin(onSuccess: () => void) {
  const setLogin = useSessionStore((s) => s.setLogin);
  const [token, setToken] = useState("");
  const [login, setLoginName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleValidate() {
    if (!token.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setLoginName((await authApi.validateToken(token.trim())).login);
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
      await authApi.saveToken(token.trim());
      setLogin(login);
      onSuccess();
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

  return { token, login, error, busy, handleValidate, handleSave, onTokenChange };
}
