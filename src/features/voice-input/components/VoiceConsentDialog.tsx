import { useTranslation } from "@/i18n";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";

interface VoiceConsentDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 「联网识别」同意框：当前语言的 on-device 模型不可用时，
 * 必须由用户显式选择联网识别（PRD §2.10 隐私边界：绝不静默上传）。
 */
export function VoiceConsentDialog({ open, onConfirm, onCancel }: VoiceConsentDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={t("voice.consentTitle")} onClose={onCancel} mobileSheet={false}>
      <div className="space-y-4 text-sm leading-6 text-text-secondary">
        <p>{t("voice.consentBody")}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button onClick={onConfirm}>{t("voice.consentUseNetwork")}</Button>
        </div>
      </div>
    </Modal>
  );
}
