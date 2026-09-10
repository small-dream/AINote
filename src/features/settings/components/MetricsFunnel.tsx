import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import {
  formatFunnelCount,
  formatFunnelPercent,
  type MetricsFunnelStep,
  type MetricsFunnelStepId,
} from "../utils/metricsFunnel";

const LABEL_KEYS: Record<MetricsFunnelStepId, TranslationKey> = {
  installed: "support.metricsFunnelInstalled",
  repoBound: "support.metricsFunnelRepoBound",
  firstNote: "support.metricsFunnelFirstNote",
  activeDays: "support.metricsFunnelActiveDays",
  syncHealth: "support.metricsFunnelSyncHealth",
};

const TARGET_KEYS: Record<MetricsFunnelStepId, TranslationKey> = {
  installed: "support.metricsFunnelBaseline",
  repoBound: "support.metricsFunnelTargetRepoBound",
  firstNote: "support.metricsFunnelTargetFirstNote",
  activeDays: "support.metricsFunnelTargetActiveDays",
  syncHealth: "support.metricsFunnelTargetSyncHealth",
};

const VERDICTS = {
  met: { key: "support.metricsFunnelMet", style: "text-accent" },
  missed: { key: "support.metricsFunnelMissed", style: "text-text-secondary" },
  unknown: { key: "support.metricsFunnelUnknown", style: "text-text-tertiary" },
} as const satisfies Record<string, { key: TranslationKey; style: string }>;

/** 设置页「本机漏斗」：五步输入指标 + 目标对照；纯展示，数据由 buildMetricsFunnel 提供。 */
export function MetricsFunnel({ steps }: { steps: MetricsFunnelStep[] }) {
  const { t } = useTranslation();

  function valueText(step: MetricsFunnelStep): string {
    if (step.id === "syncHealth") return formatFunnelPercent(step.value);
    if (step.id === "activeDays") {
      return step.value === null ? "—" : t("support.metricsFunnelDays", { value: step.value });
    }
    return formatFunnelCount(step.value);
  }

  return (
    <div className="mt-4 border-t border-border pt-3">
      <h4 className="text-xs font-medium text-text-secondary">{t("support.metricsFunnelTitle")}</h4>
      <p className="mt-1 text-xs text-text-tertiary">{t("support.metricsFunnelDescription")}</p>
      <ul className="mt-2 space-y-1.5">
        {steps.map((step) => (
          <li key={step.id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
            <span className="text-text-secondary">{t(LABEL_KEYS[step.id])}</span>
            <span className="font-medium text-text-primary">{valueText(step)}</span>
            {step.ratio === null ? null : (
              <span className="text-text-tertiary">{formatFunnelPercent(step.ratio)}</span>
            )}
            <span className="text-text-tertiary">{t(TARGET_KEYS[step.id])}</span>
            <Verdict met={step.met} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Verdict({ met }: { met: boolean | null }) {
  const { t } = useTranslation();
  const verdict = met === null ? VERDICTS.unknown : met ? VERDICTS.met : VERDICTS.missed;
  return (
    <span className={`rounded-sm bg-bg-tertiary px-1.5 py-0.5 ${verdict.style}`}>{t(verdict.key)}</span>
  );
}
