import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import type { ConversionLoss } from "../utils/conversionLoss";

interface ConvertNoteDialogProps {
  open: boolean;
  /** 静态检测出的内容损失项；为空表示未检测到会丢失的内容 */
  losses: readonly ConversionLoss[];
  converting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const LOSS_LABEL_KEYS: Record<ConversionLoss, TranslationKey> = {
  frontmatter: "richtext.convertLossFrontmatter",
  callout: "richtext.convertLossCallout",
  footnote: "richtext.convertLossFootnote",
  wikiLink: "richtext.convertLossWikiLink",
  tag: "richtext.convertLossTag",
};

/** 转换为富文本前的确认对话框：逐项列出将丢失的内容，并说明回收站/Git 提交回滚保障。Esc 取消、Enter 确认。 */
export function ConvertNoteDialog({ open, losses, converting = false, onCancel, onConfirm }: ConvertNoteDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={t("note.convertToRichText")} onClose={onCancel}>
      <div onKeyDown={(event) => {
        if (event.key !== "Enter" || converting) return;
        event.preventDefault();
        onConfirm();
      }}>
        {losses.length > 0 ? (
          <>
            <p className="mb-2 text-sm text-text-primary">{t("richtext.convertLossIntro")}</p>
            <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-warning">
              {losses.map((loss) => (
                <li key={loss}>{t(LOSS_LABEL_KEYS[loss])}</li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="mb-4 text-xs text-text-secondary">{t("richtext.convertRollback")}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={converting}>
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="primary" onClick={onConfirm} disabled={converting}>
            {converting ? t("richtext.converting") : t("common.confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
