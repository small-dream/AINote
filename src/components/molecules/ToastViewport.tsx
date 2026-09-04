import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { messageOf } from "@/api";
import { useToastStore, type ToastItem, type ToastTone } from "@/stores/toast.store";
import { useTranslation } from "@/i18n";

const ICONS: Record<ToastTone, typeof AlertCircle> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

const TONE_CLASS: Record<ToastTone, string> = {
  error: "border-danger/35 bg-danger/10 text-danger",
  success: "border-success/35 bg-success/10 text-success",
  info: "border-accent/35 bg-accent-soft text-accent",
};

/** 全局操作反馈：统一承接 mutation 错误，保留可关闭的非阻塞提示。 */
export function ToastViewport() {
  const { t } = useTranslation();
  const items = useToastStore((state) => state.items);
  const dismiss = useToastStore((state) => state.dismiss);
  return (
    <aside className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex justify-center px-4" aria-live="polite" aria-relevant="additions">
      <div className="flex w-full max-w-md flex-col gap-2">
        {items.map((item) => <Toast key={item.id} item={item} onDismiss={() => dismiss(item.id)} closeLabel={t("common.close")} />)}
      </div>
    </aside>
  );
}

function Toast({ item, onDismiss, closeLabel }: { item: ToastItem; onDismiss: () => void; closeLabel: string }) {
  const Icon = ICONS[item.tone];
  return (
    <div role={item.tone === "error" ? "alert" : "status"} className={`pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-sm ${TONE_CLASS[item.tone]}`}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words">{messageOf(item.message)}</span>
      <button type="button" aria-label={closeLabel} title={closeLabel} onClick={onDismiss} className="shrink-0 rounded p-0.5 opacity-75 hover:opacity-100">
        <X size={15} />
      </button>
    </div>
  );
}
