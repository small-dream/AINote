import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { messageOf } from "@/api";
import { useToastStore, type ToastItem, type ToastTone } from "@/stores/toast.store";
import { useTranslation } from "@/i18n";
import { Tooltip } from "@/components/atoms/Tooltip";
import { ALERT_CARD_CLASS } from "@/components/molecules/AlertCard";

const ICONS: Record<ToastTone, typeof AlertCircle> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

/** 语义色只进图标章（浅色底 + 深色图标），卡身保持实底中性面，避免文字与笔记叠影。 */
const TONE_CHIP: Record<ToastTone, string> = {
  error: "bg-danger/10 text-danger",
  success: "bg-success/10 text-success",
  info: "bg-accent-soft text-accent",
};

/** 全局操作反馈：统一承接 mutation 错误，保留可关闭的非阻塞提示。 */
export function ToastViewport() {
  const { t } = useTranslation();
  const items = useToastStore((state) => state.items);
  const dismiss = useToastStore((state) => state.dismiss);
  return (
    <aside className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] z-[70] flex justify-center px-4" aria-live="polite" aria-relevant="additions">
      <div className="flex w-full max-w-md flex-col gap-2">
        {items.map((item) => <Toast key={item.id} item={item} onDismiss={() => dismiss(item.id)} closeLabel={t("common.close")} />)}
      </div>
    </aside>
  );
}

function Toast({ item, onDismiss, closeLabel }: { item: ToastItem; onDismiss: () => void; closeLabel: string }) {
  const Icon = ICONS[item.tone];
  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 px-3 py-2.5 text-sm ${ALERT_CARD_CLASS}`}
    >
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${TONE_CHIP[item.tone]}`} aria-hidden="true">
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1 break-words text-text-primary">{messageOf(item.message)}</span>
      {item.action ? (
        <button type="button" onClick={() => { item.action?.run(); onDismiss(); }} className="shrink-0 self-center rounded px-1.5 py-0.5 text-xs font-medium text-accent underline underline-offset-2 transition-opacity hover:opacity-80">
          {item.action.label}
        </button>
      ) : null}
      <Tooltip content={closeLabel}>
        <button type="button" aria-label={closeLabel} onClick={onDismiss} className="shrink-0 rounded p-1 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary">
          <X size={15} />
        </button>
      </Tooltip>
    </div>
  );
}
