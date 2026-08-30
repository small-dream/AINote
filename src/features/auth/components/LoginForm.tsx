import { Button } from "@/components/atoms/Button";
import { useLogin } from "../hooks/useLogin";

interface LoginFormProps {
  onSuccess: () => void;
}

/** GitHub Token 登录（P0-1）：先校验，再存入本地加密文件，前端不落盘明文 */
export function LoginForm({ onSuccess }: LoginFormProps) {
  const { token, login, error, busy, handleValidate, handleSave, onTokenChange } = useLogin(onSuccess);

  return (
    <div>
      <LoginFormFields token={token} login={login} error={error} onTokenChange={onTokenChange} onEnter={() => void handleValidate()} />
      <LoginActions busy={busy} hasToken={login !== null} tokenEmpty={!token.trim()} onValidate={() => void handleValidate()} onSave={() => void handleSave()} />
    </div>
  );
}

interface LoginFormFieldsProps {
  token: string;
  login: string | null;
  error: string | null;
  onTokenChange: (token: string) => void;
  onEnter: () => void;
}

function LoginFormFields({ token, login, error, onTokenChange, onEnter }: LoginFormFieldsProps) {
  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold">连接 GitHub</h1>
      <p className="mb-6 text-text-secondary">粘贴一个可写仓库的 Personal Access Token，会保存在本地加密文件中，绝不落盘明文。</p>
      <input type="password" autoFocus className="mb-4 w-full rounded-md border border-bg-secondary bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent" placeholder="ghp_..." value={token} onChange={(e) => onTokenChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onEnter(); }} />
      {error && <p className="mb-3 text-xs text-danger">{error}</p>}
      {login && <div className="mb-4 rounded-md bg-bg-secondary p-3 text-sm">校验通过：<span className="font-medium">{login}</span></div>}
    </>
  );
}

interface LoginActionsProps {
  busy: boolean;
  hasToken: boolean;
  tokenEmpty: boolean;
  onValidate: () => void;
  onSave: () => void;
}

function LoginActions({ busy, hasToken, tokenEmpty, onValidate, onSave }: LoginActionsProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={() => window.open("https://github.com/settings/tokens", "_blank")}>如何获取 Token</Button>
      {hasToken ? (
        <Button variant="primary" onClick={onSave} disabled={busy}>{busy ? "保存中…" : "确认并继续"}</Button>
      ) : (
        <Button variant="primary" onClick={onValidate} disabled={busy || tokenEmpty}>{busy ? "校验中…" : "校验 Token"}</Button>
      )}
    </div>
  );
}
