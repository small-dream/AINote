import { Download, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useUpdate } from "../hooks/useUpdate";
import { useTranslation } from "@/i18n";

/** 设置页更新区块：手动检查，发现新版本后下载并重启。 */
export function UpdateSettings() {
  const { t } = useTranslation();
  const { info, busy, error, checked, checkForUpdate, install } = useUpdate();

  return (
    <section>
      <UpdateHeader t={t} info={info} busy={busy} onCheck={checkForUpdate} onInstall={install} />
      <UpdateMessage t={t} info={info} checked={checked} error={error} />
    </section>
  );
}

interface UpdateHeaderProps {
  t: ReturnType<typeof useTranslation>["t"];
  info: ReturnType<typeof useUpdate>["info"];
  busy: boolean;
  onCheck: () => Promise<unknown>;
  onInstall: () => Promise<void>;
}

function UpdateHeader({ t, info, busy, onCheck, onInstall }: UpdateHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold">{t("update.title")}</h3>
        <p className="mt-1 text-xs text-text-tertiary">{t("update.description")}</p>
      </div>
      {info ? <InstallButton t={t} version={info.version} busy={busy} onInstall={onInstall} /> : <CheckButton t={t} busy={busy} onCheck={onCheck} />}
    </div>
  );
}

function InstallButton({ t, version, busy, onInstall }: { t: ReturnType<typeof useTranslation>["t"]; version: string; busy: boolean; onInstall: () => Promise<void> }) {
  return <Button variant="primary" className="inline-flex items-center gap-1.5 text-xs" onClick={() => void onInstall()} disabled={busy}><Download size={14} />{busy ? t("update.installing") : t("update.install", { version })}</Button>;
}

function CheckButton({ t, busy, onCheck }: { t: ReturnType<typeof useTranslation>["t"]; busy: boolean; onCheck: () => Promise<unknown> }) {
  return <Button variant="ghost" className="inline-flex items-center gap-1.5 border border-border text-xs" onClick={() => void onCheck()} disabled={busy}><RefreshCw size={14} className={busy ? "animate-spin" : ""} />{busy ? t("update.checking") : t("update.check")}</Button>;
}

function UpdateMessage({ t, info, checked, error }: { t: ReturnType<typeof useTranslation>["t"]; info: ReturnType<typeof useUpdate>["info"]; checked: boolean; error: string | null }) {
  if (error) return <p className="text-xs text-danger">{error}</p>;
  if (info) return <p className="rounded-md bg-accent-soft p-2 text-xs text-accent"><Sparkles size={13} className="mr-1 inline" />{t("update.found", { version: info.version, details: info.body ? `: ${info.body}` : "" })}</p>;
  if (checked) return <p className="text-xs text-success">{t("update.latest")}</p>;
  return null;
}
