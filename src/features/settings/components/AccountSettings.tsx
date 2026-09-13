import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import type { HostingProviderDto } from "@/api/types";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { useAuthStatusQuery } from "@/queries/auth.queries";
import { useTranslation } from "@/i18n";
import { useAccountSettings } from "../hooks/useAccountSettings";

/** 设置页账户区块：按托管平台展示登录状态，支持补登录与断开账号 */
export function AccountSettings() {
  const { t } = useTranslation();
  const { data } = useAuthStatusQuery();
  const { disconnect, logoutAll, refresh, busyProvider, loggingOut, error } = useAccountSettings();
  const [loginTarget, setLoginTarget] = useState<HostingProviderDto | null>(null);
  const providers = data?.providers ?? [];
  const healed = useRef(false);

  // 兼容旧缓存形状（缺 providers 的历史写入）：补拉一次，避免账户区整块空白
  useEffect(() => {
    if (healed.current || !data || providers.length > 0) return;
    healed.current = true;
    void refresh();
  }, [data, providers.length, refresh]);

  return (
    <div className="flex flex-col items-start gap-3">
      <ul className="w-full space-y-2">
        {providers.map((provider) => (
          <ProviderRow
            key={provider.id}
            provider={provider}
            busy={busyProvider === provider.id}
            onLogin={() => setLoginTarget(provider)}
            onDisconnect={() => void disconnect(provider.id)}
          />
        ))}
      </ul>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button
        variant="ghost"
        className="inline-flex items-center gap-2 border border-border text-sm"
        onClick={() => void logoutAll()}
        disabled={loggingOut}
      >
        <LogOut size={15} />
        {loggingOut ? t("settings.loggingOut") : t("settings.logout")}
      </Button>
      <Modal
        open={loginTarget !== null}
        title={t("settings.loginProvider", { provider: loginTarget?.displayName ?? "" })}
        onClose={() => setLoginTarget(null)}
      >
        {loginTarget && (
          <LoginForm
            fixedProviderId={loginTarget.id}
            onSuccess={() => {
              void refresh();
              setLoginTarget(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

interface ProviderRowProps {
  provider: HostingProviderDto;
  busy: boolean;
  onLogin: () => void;
  onDisconnect: () => void;
}

function ProviderRow({ provider, busy, onLogin, onDisconnect }: ProviderRowProps) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{provider.displayName}</p>
        <p className="mt-0.5 truncate text-xs text-text-tertiary">
          {provider.hasToken
            ? t("settings.providerConnected", { login: provider.login ?? t("settings.unknownUser") })
            : t("settings.providerDisconnected")}
        </p>
      </div>
      {provider.hasToken ? (
        <Button variant="ghost" className="shrink-0 border border-border text-xs" onClick={onDisconnect} disabled={busy}>
          {busy ? t("settings.providerDisconnecting") : t("settings.providerDisconnect")}
        </Button>
      ) : (
        <Button variant="ghost" className="shrink-0 border border-border text-xs" onClick={onLogin}>
          {t("settings.providerLogin")}
        </Button>
      )}
    </li>
  );
}
