import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { useVaultSettings } from "../hooks/useVaultSettings";
import { PASSPHRASE_ISSUE_KEYS, passphraseIssue } from "../utils/passphrase";
import { vaultErrorText } from "../utils/errorText";
import { VaultField, VaultPassphraseInput } from "./VaultField";

interface VaultChangePassphraseFormProps {
  context: readonly string[];
  onDone: () => void;
}

/** 改口令：旧口令验证 + 新口令强度校验；只重新封装主密钥，笔记文件不变。 */
export function VaultChangePassphraseForm({ context, onDone }: VaultChangePassphraseFormProps) {
  const { t } = useTranslation();
  const { changePassphrase } = useVaultSettings();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const issue = next === "" ? null : passphraseIssue(next, context);
  const mismatch = confirm !== "" && confirm !== next;
  const ready = current !== "" && next !== "" && issue === null && confirm === next;

  const submit = () => {
    if (!ready || changePassphrase.isPending) return;
    changePassphrase.mutate(
      { oldPassphrase: current, newPassphrase: next },
      {
        onSuccess: () => {
          setCurrent("");
          setNext("");
          setConfirm("");
          onDone();
        },
      },
    );
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      <VaultField label={t("vault.currentPassphraseLabel")}>
        <VaultPassphraseInput autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} />
      </VaultField>
      <VaultField label={t("vault.passphraseLabel")}>
        <VaultPassphraseInput value={next} onChange={(event) => setNext(event.target.value)} />
      </VaultField>
      {issue !== null && <p className="text-xs text-danger">{t(PASSPHRASE_ISSUE_KEYS[issue])}</p>}
      <VaultField label={t("vault.passphraseConfirmLabel")}>
        <VaultPassphraseInput value={confirm} onChange={(event) => setConfirm(event.target.value)} />
      </VaultField>
      {mismatch && <p className="text-xs text-danger">{t("vault.passphraseMismatch")}</p>}
      <div className="flex items-center gap-2">
        <Button type="button" disabled={!ready || changePassphrase.isPending} onClick={submit}>
          {changePassphrase.isPending ? t("vault.changing") : t("vault.changeAction")}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t("common.cancel")}
        </Button>
        {changePassphrase.isError && (
          <p className="text-xs text-danger" role="alert">
            {vaultErrorText(changePassphrase.error, t)}
          </p>
        )}
      </div>
    </div>
  );
}
