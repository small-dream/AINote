import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { useVaultSettings } from "../hooks/useVaultSettings";
import { vaultErrorText } from "../utils/errorText";
import { VaultField, VaultPassphraseInput } from "./VaultField";

/** 解锁表单：口令只透传给 Rust，成功后清空输入框（前端不留任何口令痕迹）。 */
export function VaultUnlockCard() {
  const { t } = useTranslation();
  const { unlock } = useVaultSettings();
  const [passphrase, setPassphrase] = useState("");

  const submit = () => {
    if (passphrase === "" || unlock.isPending) return;
    unlock.mutate(passphrase, { onSuccess: () => setPassphrase("") });
  };

  return (
    <section className="rounded-md border border-border p-3">
      <p className="text-sm font-medium text-text-primary">{t("vault.unlockTitle")}</p>
      <p className="mt-1 text-xs text-text-secondary">{t("vault.unlockDescription")}</p>
      <div className="mt-3 flex flex-col gap-2">
        <VaultField label={t("vault.passphraseLabel")}>
          <VaultPassphraseInput
            autoFocus
            autoComplete="current-password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
        </VaultField>
        <div className="flex items-center gap-2">
          <Button type="button" disabled={passphrase === "" || unlock.isPending} onClick={submit}>
            {unlock.isPending ? t("vault.unlocking") : t("vault.unlockAction")}
          </Button>
          {unlock.isError && (
            <p className="text-xs text-danger" role="alert">
              {vaultErrorText(unlock.error, t)}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
