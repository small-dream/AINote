import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { useVaultDeviceUnlock } from "../hooks/useVaultDeviceUnlock";
import { useVaultSettings } from "../hooks/useVaultSettings";
import { vaultErrorText } from "../utils/errorText";
import { VaultField, VaultPassphraseInput } from "./VaultField";

interface VaultUnlockCardProps {
  /** 解锁成功后回调（全局解锁弹层用于自动关闭）；设置页内嵌场景不传。 */
  onUnlocked?: () => void;
}

/** 解锁表单：口令只透传给 Rust，成功后清空输入框（前端不留任何口令痕迹）。 */
export function VaultUnlockCard({ onUnlocked }: VaultUnlockCardProps = {}) {
  const { t } = useTranslation();
  const { unlock } = useVaultSettings();
  const device = useVaultDeviceUnlock();
  const [passphrase, setPassphrase] = useState("");

  const submit = () => {
    if (passphrase === "" || unlock.isPending) return;
    unlock.mutate(passphrase, {
      onSuccess: () => {
        setPassphrase("");
        onUnlocked?.();
      },
    });
  };

  return (
    <section className="rounded-md border border-border p-3">
      <p className="text-sm font-medium text-text-primary">{t("vault.unlockTitle")}</p>
      <p className="mt-1 text-xs text-text-secondary">{t("vault.unlockDescription")}</p>
      {device.quick.enabled && <VaultDeviceUnlockBlock device={device} onUnlocked={onUnlocked} />}
      <div className="mt-3 flex flex-col gap-2">
        <VaultField label={t("vault.passphraseLabel")}>
          <VaultPassphraseInput
            autoFocus
            autoComplete="current-password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) submit();
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

type DeviceUnlock = ReturnType<typeof useVaultDeviceUnlock>;

/** 设备认证解锁区块：主操作在口令之前，取消静默、失败就地提示。 */
function VaultDeviceUnlockBlock({
  device,
  onUnlocked,
}: {
  device: DeviceUnlock;
  onUnlocked?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-3 flex flex-col gap-2">
      <Button type="button" disabled={device.pending} onClick={() => device.unlock(onUnlocked)}>
        {device.pending
          ? t("vault.deviceUnlocking")
          : t("vault.deviceUnlockAction", { kind: device.kindLabel })}
      </Button>
      {device.error !== null && (
        <p className="text-xs text-danger" role="alert">
          {device.error}
        </p>
      )}
      <p className="text-xs text-text-tertiary">{t("vault.deviceUnlockFallback")}</p>
    </div>
  );
}
