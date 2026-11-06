import { Button } from "@/components/atoms/Button";
import type { HostingProviderDto } from "@/api/types";
import { useAuthStatusQuery } from "@/queries/auth.queries";
import { isExternalHttpUrl, openExternalLink } from "@/platform/open-link";
import { reportToastError } from "@/stores/toast.store";
import { useLogin } from "../hooks/useLogin";
import { useTranslation } from "@/i18n";

interface LoginFormProps {
  /** 校验并保存成功后回调账号名与平台（供调用方更新本地状态） */
  onSuccess: (result: { login: string; providerId: string }) => void;
  /** 固定平台（设置页补登录）：不展示平台选择器 */
  fixedProviderId?: string;
}

/** 平台授权（P0-1）：选择托管平台 → 校验令牌 → 存入本地安全存储，前端不落盘明文 */
export function LoginForm({ onSuccess, fixedProviderId }: LoginFormProps) {
  const { t } = useTranslation();
  const { data } = useAuthStatusQuery();
  const providers = data?.providers ?? [];
  const { providerId, token, login, error, busy, selectProvider, handleValidate, handleSave, onTokenChange } =
    useLogin(onSuccess, { fixedProviderId });
  const active = providers.find((provider) => provider.id === providerId);
  const tokenPage = active && isExternalHttpUrl(active.tokenPage) ? active.tokenPage : undefined;
  /** 令牌申请页：壳内 window.open / target=_blank 不会创建新窗口，必须交给系统浏览器 */
  const handleGetToken = () => {
    if (!tokenPage) return;
    void openExternalLink(tokenPage).catch(reportToastError);
  };

  return (
    <div>
      <ProviderPicker providers={providers} activeId={providerId} onSelect={selectProvider} visible={!fixedProviderId} />
      <LoginFormFields
        t={t}
        providerName={active?.displayName ?? providerId}
        token={token}
        login={login}
        error={error}
        onTokenChange={onTokenChange}
        onEnter={() => void handleValidate()}
      />
      <LoginActions
        t={t}
        busy={busy}
        hasToken={login !== null}
        tokenEmpty={!token.trim()}
        onGetToken={tokenPage ? handleGetToken : undefined}
        onValidate={() => void handleValidate()}
        onSave={() => void handleSave()}
      />
    </div>
  );
}

interface ProviderPickerProps {
  providers: HostingProviderDto[];
  activeId: string;
  onSelect: (id: string) => void;
  visible: boolean;
}

/** 平台选择器：只有一个平台时不占用界面空间 */
function ProviderPicker({ providers, activeId, onSelect, visible }: ProviderPickerProps) {
  if (!visible || providers.length < 2) return null;
  return (
    <div className="mb-5 flex overflow-hidden rounded-md border border-bg-secondary text-sm" role="tablist">
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          role="tab"
          aria-selected={provider.id === activeId}
          className={`flex-1 px-3 py-1.5 ${provider.id === activeId ? "bg-accent text-white" : "text-text-secondary"}`}
          onClick={() => onSelect(provider.id)}
        >
          {provider.displayName}
        </button>
      ))}
    </div>
  );
}

interface LoginFormFieldsProps {
  t: ReturnType<typeof useTranslation>["t"];
  providerName: string;
  token: string;
  login: string | null;
  error: string | null;
  onTokenChange: (token: string) => void;
  onEnter: () => void;
}

function LoginFormFields({ t, providerName, token, login, error, onTokenChange, onEnter }: LoginFormFieldsProps) {
  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold">{t("auth.connect")}</h1>
      <p className="mb-6 text-text-secondary">{t("auth.description")}</p>
      <input
        type="password"
        autoFocus
        className="mb-4 w-full rounded-md border border-bg-secondary bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent"
        placeholder={t("auth.tokenPlaceholder", { provider: providerName })}
        value={token}
        onChange={(e) => onTokenChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) onEnter(); }}
      />
      {error && <p className="mb-3 text-xs text-danger">{error}</p>}
      {login && <div className="mb-4 rounded-md bg-bg-secondary p-3 text-sm">{t("auth.validated", { login: "" })}<span className="font-medium">{login}</span></div>}
    </>
  );
}

interface LoginActionsProps {
  t: ReturnType<typeof useTranslation>["t"];
  busy: boolean;
  hasToken: boolean;
  tokenEmpty: boolean;
  onGetToken: (() => void) | undefined;
  onValidate: () => void;
  onSave: () => void;
}

function LoginActions({ t, busy, hasToken, tokenEmpty, onGetToken, onValidate, onSave }: LoginActionsProps) {
  return (
    <div className="flex justify-end gap-2">
      {onGetToken && (
        <Button variant="ghost" onClick={onGetToken}>{t("auth.getToken")}</Button>
      )}
      {hasToken ? (
        <Button variant="primary" onClick={onSave} disabled={busy}>{busy ? t("common.saving") : t("auth.continue")}</Button>
      ) : (
        <Button variant="primary" onClick={onValidate} disabled={busy || tokenEmpty}>{busy ? t("auth.validating") : t("auth.validate")}</Button>
      )}
    </div>
  );
}
