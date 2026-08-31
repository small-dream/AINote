import { Button } from "@/components/atoms/Button";
import { useLogin } from "../hooks/useLogin";
import { useTranslation } from "@/i18n";

interface LoginFormProps {
  onSuccess: () => void;
}

/** GitHub Token 登录（P0-1）：先校验，再存入本地加密文件，前端不落盘明文 */
export function LoginForm({ onSuccess }: LoginFormProps) {
  const { t } = useTranslation();
  const { token, login, error, busy, handleValidate, handleSave, onTokenChange } = useLogin(onSuccess);

  return (
    <div>
      <LoginFormFields t={t} token={token} login={login} error={error} onTokenChange={onTokenChange} onEnter={() => void handleValidate()} />
      <LoginActions t={t} busy={busy} hasToken={login !== null} tokenEmpty={!token.trim()} onValidate={() => void handleValidate()} onSave={() => void handleSave()} />
    </div>
  );
}

interface LoginFormFieldsProps {
  t: ReturnType<typeof useTranslation>["t"];
  token: string;
  login: string | null;
  error: string | null;
  onTokenChange: (token: string) => void;
  onEnter: () => void;
}

function LoginFormFields({ t, token, login, error, onTokenChange, onEnter }: LoginFormFieldsProps) {
  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold">{t("auth.connect")}</h1>
      <p className="mb-6 text-text-secondary">{t("auth.description")}</p>
      <input type="password" autoFocus className="mb-4 w-full rounded-md border border-bg-secondary bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent" placeholder="ghp_..." value={token} onChange={(e) => onTokenChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onEnter(); }} />
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
  onValidate: () => void;
  onSave: () => void;
}

function LoginActions({ t, busy, hasToken, tokenEmpty, onValidate, onSave }: LoginActionsProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={() => window.open("https://github.com/settings/tokens", "_blank")}>{t("auth.getToken")}</Button>
      {hasToken ? (
        <Button variant="primary" onClick={onSave} disabled={busy}>{busy ? t("common.saving") : t("auth.continue")}</Button>
      ) : (
        <Button variant="primary" onClick={onValidate} disabled={busy || tokenEmpty}>{busy ? t("auth.validating") : t("auth.validate")}</Button>
      )}
    </div>
  );
}
