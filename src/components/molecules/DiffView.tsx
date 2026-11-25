import { useTranslation } from "@/i18n";
import type { DiffLine } from "@/api/types";

interface DiffViewProps {
  lines: DiffLine[] | undefined;
  loading: boolean;
  /** 未选择条目时的提示（默认沿用历史面板文案） */
  emptyText?: string;
  /** 条目没有内容改动时的提示 */
  noChangesText?: string;
}

const KIND_CLASS: Record<DiffLine["kind"], string> = {
  added: "bg-success/10 text-text-primary",
  removed: "bg-danger/10 text-text-primary",
  context: "text-text-secondary",
};

const KIND_SIGN: Record<DiffLine["kind"], string> = {
  added: "+",
  removed: "-",
  context: " ",
};

/** 通用逐行 diff 视图：按 +/- 着色，供历史、Git Graph 与待提交改动复用。 */
export function DiffView({ lines, loading, emptyText, noChangesText }: DiffViewProps) {
  const { t } = useTranslation();
  if (loading) return <DiffEmpty text={t("common.loading")} />;
  if (!lines) return <DiffEmpty text={emptyText ?? t("history.emptyDiff")} />;
  if (lines.length === 0) return <DiffEmpty text={noChangesText ?? t("history.noChanges")} />;
  return (
    <div className="min-h-0 flex-1 overflow-auto px-1 py-2 font-mono text-[12px] leading-5">
      {lines.map((line, index) => (
        <div key={index} className={`flex whitespace-pre-wrap break-words rounded-sm px-3 ${KIND_CLASS[line.kind]}`}>
          <span className="mr-3 w-3 shrink-0 select-none text-text-tertiary">{KIND_SIGN[line.kind]}</span>
          <span className="min-w-0">{line.text || " "}</span>
        </div>
      ))}
    </div>
  );
}

function DiffEmpty({ text }: { text: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-text-tertiary">
      {text}
    </div>
  );
}
