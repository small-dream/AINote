import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { useVaultLock } from "../hooks/useVaultLock";
import { useVaultSettings } from "../hooks/useVaultSettings";
import { VaultChangePassphraseForm } from "./VaultChangePassphraseForm";

/** 已解锁态：提供锁定与改口令；锁定前由内容层保证草稿已落盘。 */
export function VaultUnlockedCard() {
  const { t } = useTranslation();
  const { repoContext } = useVaultSettings();
  const { lockNow, pending, error, clearError } = useVaultLock();
  const [changing, setChanging] = useState(false);

  return (
    <section className="rounded-md border border-border p-3">
      <p className="text-sm font-medium text-text-primary">{t("vault.unlockedTitle")}</p>
      <p className="mt-1 text-xs text-text-secondary">{t("vault.unlockedDescription")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          className="inline-flex items-center gap-1.5 border border-border"
          disabled={pending}
          onClick={lockNow}
        >
          <Lock size={13} />
          {pending ? t("vault.locking") : t("vault.lockAction")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => { clearError(); setChanging((open) => !open); }}>
          {t("vault.changeTitle")}
        </Button>
      </div>
      {error !== null && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      {changing && <VaultChangePassphraseForm context={repoContext} onDone={() => setChanging(false)} />}
    </section>
  );
}
