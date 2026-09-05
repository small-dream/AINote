import type { CSSProperties } from "react";
import type { UpdateProgress } from "@/api/update.api";
import { useTranslation } from "@/i18n";
import { formatBytes } from "../utils/updateFormat";

interface UpdateProgressBarProps {
  progress: UpdateProgress | null;
}

interface ProgressPresentation {
  percent: number | null;
  ariaValueNow: number | undefined;
  barClassName: string;
  barStyle: CSSProperties | undefined;
  text: string;
}

export function UpdateProgressBar({ progress }: UpdateProgressBarProps) {
  const { t } = useTranslation();
  const presentation = getProgressPresentation(progress, t);

  return (
    <div className="space-y-2" aria-live="polite">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={presentation.ariaValueNow}
        aria-label={t("update.downloading")}
        className="h-1.5 w-full overflow-hidden rounded-full bg-bg-tertiary"
      >
        <div className={presentation.barClassName} style={presentation.barStyle} />
      </div>
      <p className="text-xs text-text-secondary">{presentation.text}</p>
    </div>
  );
}

function getProgressPresentation(
  progress: UpdateProgress | null,
  t: ReturnType<typeof useTranslation>["t"],
): ProgressPresentation {
  const safeProgress = progress ?? { receivedBytes: 0, totalBytes: null, percent: null };
  const percent = safeProgress.percent;
  const receivedText = formatBytes(safeProgress.receivedBytes);
  const text = percent === null
    ? t("update.progressUnknown", { received: receivedText })
    : t("update.progress", { percent, received: receivedText, total: formatBytes(safeProgress.totalBytes ?? 0) });

  return {
    percent,
    ariaValueNow: percent ?? undefined,
    barClassName: percent === null
      ? "update-progress-indeterminate h-full w-1/3 rounded-full bg-accent"
      : "h-full rounded-full bg-accent transition-[width] duration-200 ease-out",
    barStyle: percent === null ? undefined : { width: `${percent}%` },
    text,
  };
}
