import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import type { ConflictPending } from "../hooks/useConflictMerge";
import { splitLines } from "../utils/merge";
import type { TranslationKey } from "@/i18n/messages";

interface ConflictLinePaneProps {
  titleKey: Extract<TranslationKey, "sync.localPane" | "sync.remotePane">;
  content: string;
  onAddLine: (line: string) => void;
  onAppendAll: (lines: string[]) => void;
  disabled: boolean;
  /** touch：移动端放大触控目标（整段追加 36px、行 32px），桌面保持紧凑 */
  touch?: boolean;
}

/** 原文侧栏（本地 / 远端）：点某行追加到合并结果，标题栏可整段追加 */
export function ConflictLinePane({ titleKey, content, onAddLine, onAppendAll, disabled, touch = false }: ConflictLinePaneProps) {
  const { t } = useTranslation();
  const lines = splitLines(content);
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{t(titleKey)}</span>
        <Button
          variant="ghost"
          className={touch ? "shrink-0 min-h-9 px-3 text-xs" : "shrink-0 px-2 py-0.5 text-[11px]"}
          title={t("sync.appendAllHint")}
          disabled={disabled}
          onClick={() => onAppendAll(lines)}
        >
          {t("sync.appendAll")}
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 font-mono text-xs">
        {lines.map((line, index) => (
          <button
            key={index}
            type="button"
            title={t("sync.addLine")}
            disabled={disabled}
            onClick={() => onAddLine(line)}
            className={`flex w-full items-start gap-1 rounded px-1 text-left hover:bg-bg-secondary disabled:opacity-60 ${touch ? "min-h-8 py-0.5" : ""}`}
          >
            <span className="w-6 shrink-0 select-none text-right text-text-tertiary">{index + 1}</span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-all">{line}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** 合并结果编辑器：默认装载本地侧内容，可直接改写 */
export function MergeEditor({ merged, onChange }: { merged: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <header className="conflict-merge-header flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{t("sync.merged")}</span>
      </header>
      <textarea
        value={merged}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        aria-label={t("sync.merged")}
        className="conflict-merge-textarea min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-5 outline-none"
      />
    </>
  );
}

interface ConflictActionsProps {
  onKeepLocal: () => void;
  onKeepRemote: () => void;
  onSave: () => void;
  pending: ConflictPending;
  disabled: boolean;
  /** touch：移动端底部操作条，按钮拉到 44px 且等宽 */
  variant?: "compact" | "touch";
}

/** 合并结果操作条：一键保留某一侧（立即解决该文件）或保存手动编辑的结果 */
export function ConflictActions({ onKeepLocal, onKeepRemote, onSave, pending, disabled, variant = "compact" }: ConflictActionsProps) {
  const { t } = useTranslation();
  const touch = variant === "touch";
  const size = touch ? "min-h-11 flex-1" : "";
  const shell = touch
    ? "conflict-mobile-actions flex shrink-0 items-center gap-2 border-t border-border px-3 py-2"
    : "flex shrink-0 items-center gap-2 border-t border-border px-3 py-2";
  return (
    <div className={shell}>
      <Button variant="ghost" className={size} disabled={disabled} onClick={onKeepLocal}>
        {pending === "local" ? t("sync.resolving") : t("sync.keepLocal")}
      </Button>
      <Button variant="ghost" className={size} disabled={disabled} onClick={onKeepRemote}>
        {pending === "remote" ? t("sync.resolving") : t("sync.keepRemote")}
      </Button>
      <Button variant="primary" className={`${size} ${touch ? "" : "ml-auto"}`} disabled={disabled} onClick={onSave}>
        {pending === "merge" ? t("sync.resolving") : t("sync.saveMerge")}
      </Button>
    </div>
  );
}

const PANE_TABS = [
  { key: "local", label: "sync.localPane" },
  { key: "merge", label: "sync.merged" },
  { key: "remote", label: "sync.remotePane" },
] as const satisfies ReadonlyArray<{ key: "local" | "merge" | "remote"; label: TranslationKey }>;

export type ConflictPaneKey = (typeof PANE_TABS)[number]["key"];

/** 移动端面板切换：一次只看一栏（本地 / 合并结果 / 远端），避免三栏挤在手机宽度里 */
export function ConflictPaneTabs({ active, onChange }: { active: ConflictPaneKey; onChange: (key: ConflictPaneKey) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 gap-1 border-b border-border px-2 py-1.5" role="tablist" aria-label={t("sync.conflictPanes")}>
      {PANE_TABS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={active === key}
          className={`min-h-9 flex-1 rounded-md text-xs transition-colors ${active === key ? "bg-accent/10 font-medium text-accent" : "text-text-secondary"}`}
          onClick={() => onChange(key)}
        >
          {t(label)}
        </button>
      ))}
    </div>
  );
}
