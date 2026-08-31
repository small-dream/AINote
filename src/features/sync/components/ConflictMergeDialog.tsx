import { X } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { useConflictMerge } from "../hooks/useConflictMerge";
import { splitLines } from "../utils/merge";
import type { ConflictFile } from "@/api/types";

interface ConflictMergeDialogProps {
  repoPath: string | null;
  open: boolean;
  onClose: () => void;
}

/** 合并冲突图形化处理（P1-3）：本地 | 合并结果 | 远端 三栏，行级挑选 + 手动编辑 */
export function ConflictMergeDialog({ repoPath, open, onClose }: ConflictMergeDialogProps) {
  const merge = useConflictMerge(repoPath, open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={merge.file?.path ?? "conflict"} className="mx-auto mt-10 flex h-[80vh] w-[min(1120px,94vw)] flex-col overflow-hidden rounded-xl bg-bg-primary shadow-2xl">
        <MergeHeader conflicts={merge.conflicts} current={merge.current} onSelect={merge.setCurrent} keepAll={merge.keepAll} onClose={onClose} />
        <div className="grid min-h-0 flex-1 grid-cols-3 divide-x divide-border">
          <LinePane titleKey="sync.localPane" lines={splitLines(merge.file?.local ?? "")} onAddLine={merge.addLine} />
          <MergePane
            merged={merge.merged}
            onChange={merge.setMerged}
            onKeepLocal={merge.keepLocal}
            onKeepRemote={merge.keepRemote}
            onSave={merge.saveMerge}
            resolving={merge.resolving}
          />
          <LinePane titleKey="sync.remotePane" lines={splitLines(merge.file?.remote ?? "")} onAddLine={merge.addLine} />
        </div>
      </div>
    </div>
  );
}

interface MergeHeaderProps {
  conflicts: ConflictFile[];
  current: number;
  onSelect: (index: number) => void;
  keepAll: (useLocal: boolean) => void;
  onClose: () => void;
}

function MergeHeader({ conflicts, current, onSelect, keepAll, onClose }: MergeHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
      <h2 className="shrink-0 text-sm font-semibold">{t("sync.conflictMerge")}</h2>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {conflicts.map((conflict, index) => (
          <button
            key={conflict.path}
            type="button"
            onClick={() => onSelect(index)}
            className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition-colors ${index === current ? "bg-accent/10 text-accent" : "text-text-secondary hover:bg-bg-secondary"}`}
          >
            {conflict.path}
          </button>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button variant="ghost" className="px-2 text-xs" onClick={() => keepAll(true)}>{t("sync.keepLocalAll")}</Button>
        <Button variant="ghost" className="px-2 text-xs" onClick={() => keepAll(false)}>{t("sync.keepRemoteAll")}</Button>
      </div>
      <button type="button" aria-label={t("common.cancel")} onClick={onClose} className="shrink-0 rounded p-1 text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary">
        <X size={16} />
      </button>
    </div>
  );
}

interface LinePaneProps {
  titleKey: "sync.localPane" | "sync.remotePane";
  lines: string[];
  onAddLine: (line: string) => void;
}

function LinePane({ titleKey, lines, onAddLine }: LinePaneProps) {
  const { t } = useTranslation();
  return (
    <section className="flex min-h-0 flex-col">
      <header className="shrink-0 border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">{t(titleKey)}</header>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 font-mono text-xs">
        {lines.map((line, index) => (
          <button
            key={index}
            type="button"
            title={t("sync.addLine")}
            onClick={() => onAddLine(line)}
            className="flex w-full items-start gap-1 rounded px-1 text-left hover:bg-bg-secondary"
          >
            <span className="w-6 shrink-0 select-none text-right text-text-tertiary">{index + 1}</span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-all">{line}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

interface MergePaneProps {
  merged: string;
  onChange: (value: string) => void;
  onKeepLocal: () => void;
  onKeepRemote: () => void;
  onSave: () => void;
  resolving: boolean;
}

function MergePane({ merged, onChange, onKeepLocal, onKeepRemote, onSave, resolving }: MergePaneProps) {
  const { t } = useTranslation();
  return (
    <section className="flex min-h-0 flex-col">
      <header className="shrink-0 border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">{t("sync.merged")}</header>
      <textarea
        value={merged}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        aria-label={t("sync.merged")}
        className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-5 outline-none"
      />
      <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2">
        <Button variant="ghost" onClick={onKeepLocal}>{t("sync.keepLocal")}</Button>
        <Button variant="ghost" onClick={onKeepRemote}>{t("sync.keepRemote")}</Button>
        <Button variant="primary" onClick={onSave} disabled={resolving} className="ml-auto">{resolving ? t("sync.resolving") : t("sync.saveMerge")}</Button>
      </div>
    </section>
  );
}
