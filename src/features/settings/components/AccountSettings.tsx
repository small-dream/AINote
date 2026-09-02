import { useState } from "react";
import { useNavigate } from "react-router";
import { LogOut } from "lucide-react";
import { authApi } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useSessionStore } from "@/stores/session.store";
import { useUiStore } from "@/stores/ui.store";
import { useTranslation } from "@/i18n";

/** 设置页账户区块：展示当前 GitHub 登录状态并退出登录。 */
export function AccountSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useSessionStore((s) => s.login);
  const reset = useSessionStore((s) => s.reset);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      await authApi.logout();
      reset();
      closeSettings();
      navigate("/setup", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-text-secondary">{t("settings.signedInAs", { login: login ?? t("settings.unknownUser") })}</p>
      <Button
        variant="ghost"
        className="inline-flex items-center gap-2 border border-border text-sm"
        onClick={() => void handleLogout()}
        disabled={busy}
      >
        <LogOut size={15} />
        {busy ? t("settings.loggingOut") : t("settings.logout")}
      </Button>
    </div>
  );
}
