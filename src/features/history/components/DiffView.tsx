import { useTranslation } from "@/i18n";
import type { DiffLine, FileDiff } from "../types";

interface DiffViewProps {
  diff: FileDiff | undefined;
  loading: boolean;
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

/** diff 视图（右栏）：按行渲染 +/- 着色 */
export function DiffView({ diff, loading }: DiffViewProps) {
  const { t } = useTranslation();
  if (loading) return <DiffEmpty text={t("common.loading")} />;
  if (!diff) return <DiffEmpty text={t("history.emptyDiff")} />;
  if (diff.lines.length === 0) return <DiffEmpty text={t("history.noChanges")} />;
  return (
    <div className="min-h-0 flex-1 overflow-auto px-1 py-2 font-mono text-[12px] leading-5">
      {diff.lines.map((line, index) => (
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
