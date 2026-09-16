import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { messageOf } from "@/api/error";
import { flushPendingDrafts } from "@/features/note/utils/draftRegistry";
import { useVaultSettings } from "../hooks/useVaultSettings";
import { VaultChangePassphraseForm } from "./VaultChangePassphraseForm";

/** 已解锁态：提供锁定与改口令；锁定前由内容层保证草稿已落盘。 */
export function VaultUnlockedCard() {
  const { t } = useTranslation();
  const { lock, repoContext } = useVaultSettings();
  const [changing, setChanging] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);

  // 锁定前必须先落盘：否则未保存的草稿会停留在内存里，锁定后连读回的机会都没有。
  const lockNow = () => {
    if (lock.isPending) return;
    setLockError(null);
    void flushPendingDrafts()
      .then(() => lock.mutate())
      .catch((error: unknown) => setLockError(messageOf(error)));
  };

  return (
    <section className="rounded-md border border-border p-3">
      <p className="text-sm font-medium text-text-primary">{t("vault.unlockedTitle")}</p>
      <p className="mt-1 text-xs text-text-secondary">{t("vault.unlockedDescription")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          className="inline-flex items-center gap-1.5 border border-border"
          disabled={lock.isPending}
          onClick={lockNow}
        >
          <Lock size={13} />
          {lock.isPending ? t("vault.locking") : t("vault.lockAction")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setChanging((open) => !open)}>
          {t("vault.changeTitle")}
        </Button>
      </div>
      {lockError !== null && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {t("vault.lockFlushFailed", { message: lockError })}
        </p>
      )}
      {changing && <VaultChangePassphraseForm context={repoContext} onDone={() => setChanging(false)} />}
    </section>
  );
}
