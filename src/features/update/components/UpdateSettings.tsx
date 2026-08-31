import { Download, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useUpdate } from "../hooks/useUpdate";

/** 设置页更新区块：手动检查，发现新版本后下载并重启。 */
export function UpdateSettings() {
  const { info, busy, error, checked, checkForUpdate, install } = useUpdate();

  return (
    <section>
      <UpdateHeader info={info} busy={busy} onCheck={checkForUpdate} onInstall={install} />
      <UpdateMessage info={info} checked={checked} error={error} />
    </section>
  );
}

interface UpdateHeaderProps {
  info: ReturnType<typeof useUpdate>["info"];
  busy: boolean;
  onCheck: () => Promise<unknown>;
  onInstall: () => Promise<void>;
}

function UpdateHeader({ info, busy, onCheck, onInstall }: UpdateHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold">软件更新</h3>
        <p className="mt-1 text-xs text-text-tertiary">从 GitHub Releases 获取签名更新</p>
      </div>
      {info ? <InstallButton version={info.version} busy={busy} onInstall={onInstall} /> : <CheckButton busy={busy} onCheck={onCheck} />}
    </div>
  );
}

function InstallButton({ version, busy, onInstall }: { version: string; busy: boolean; onInstall: () => Promise<void> }) {
  return <Button variant="primary" className="inline-flex items-center gap-1.5 text-xs" onClick={() => void onInstall()} disabled={busy}><Download size={14} />{busy ? "安装中…" : `更新到 ${version}`}</Button>;
}

function CheckButton({ busy, onCheck }: { busy: boolean; onCheck: () => Promise<unknown> }) {
  return <Button variant="ghost" className="inline-flex items-center gap-1.5 border border-border text-xs" onClick={() => void onCheck()} disabled={busy}><RefreshCw size={14} className={busy ? "animate-spin" : ""} />{busy ? "检查中…" : "检查更新"}</Button>;
}

function UpdateMessage({ info, checked, error }: { info: ReturnType<typeof useUpdate>["info"]; checked: boolean; error: string | null }) {
  if (error) return <p className="text-xs text-danger">{error}</p>;
  if (info) return <p className="rounded-md bg-accent-soft p-2 text-xs text-accent"><Sparkles size={13} className="mr-1 inline" />发现新版本 {info.version}{info.body ? `：${info.body}` : ""}</p>;
  if (checked) return <p className="text-xs text-success">当前已是最新版本。</p>;
  return null;
}
