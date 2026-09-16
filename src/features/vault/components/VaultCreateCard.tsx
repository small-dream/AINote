import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { useVaultSettings } from "../hooks/useVaultSettings";
import { PASSPHRASE_ISSUE_KEYS, passphraseIssue } from "../utils/passphrase";
import { vaultErrorText } from "../utils/errorText";
import { VaultField, VaultPassphraseInput } from "./VaultField";

/** 建库表单：口令强度 + 二次输入 + 不可恢复确认（无恢复码，决策 ⑥）。 */
export function VaultCreateCard() {
  const { t } = useTranslation();
  const { create, repoContext } = useVaultSettings();
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const issue = passphraseIssue(passphrase, repoContext);
  const mismatch = confirm !== "" && confirm !== passphrase;
  const ready = passphrase !== "" && issue === null && confirm === passphrase && acknowledged;

  const submit = () => {
    if (!ready || create.isPending) return;
    const clear = () => (setPassphrase(""), setConfirm(""), setAcknowledged(false));
    create.mutate(passphrase, { onSuccess: clear });
  };

  return (
    <section className="rounded-md border border-border p-3">
      <p className="text-sm font-medium text-text-primary">{t("vault.createTitle")}</p>
      <p className="mt-1 text-xs text-text-secondary">{t("vault.createDescription")}</p>
      <div className="mt-3 flex flex-col gap-2">
        <VaultField label={t("vault.passphraseLabel")}>
          <VaultPassphraseInput
            value={passphrase}
            placeholder={t("vault.passphrasePlaceholder")}
            onChange={(event) => setPassphrase(event.target.value)}
          />
        </VaultField>
        {passphrase !== "" && issue !== null && (
          <p className="text-xs text-danger">{t(PASSPHRASE_ISSUE_KEYS[issue])}</p>
        )}
        <VaultField label={t("vault.passphraseConfirmLabel")}>
          <VaultPassphraseInput value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </VaultField>
        {mismatch && <p className="text-xs text-danger">{t("vault.passphraseMismatch")}</p>}
        <label className="flex items-start gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>{t("vault.unrecoverableConfirm")}</span>
        </label>
        <div className="flex items-center gap-2">
          <Button type="button" disabled={!ready || create.isPending} onClick={submit}>
            {create.isPending ? t("vault.creating") : t("vault.createAction")}
          </Button>
          {create.isError && (
            <p className="text-xs text-danger" role="alert">
              {vaultErrorText(create.error, t)}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
