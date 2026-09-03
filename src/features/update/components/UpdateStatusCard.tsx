import { CircleAlert, Download, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import { Button } from "@/components/atoms/Button";
import type { UpdateInfo } from "@/api/update.api";
import type { UpdatePhase } from "../hooks/useUpdate";
import { formatCheckedAt } from "../utils/updateFormat";

interface UpdateStatusCardProps {
  phase: UpdatePhase;
  info: UpdateInfo | null;
  currentVersion: string | null;
  checkedAt: Date | null;
  error: string | null;
  onCheck: () => Promise<unknown>;
  onInstall: () => Promise<void>;
}

const STATUS_COPY: Record<UpdatePhase, { titleKey: TranslationKey; descriptionKey: TranslationKey }> = {
  initializing: { titleKey: "update.statusInitializing", descriptionKey: "update.readyDescription" },
  ready: { titleKey: "update.statusReady", descriptionKey: "update.readyDescription" },
  checking: { titleKey: "update.checking", descriptionKey: "update.checkingDescription" },
  upToDate: { titleKey: "update.latest", descriptionKey: "update.checkedDescription" },
  readyToInstall: { titleKey: "update.found", descriptionKey: "update.installDescription" },
  downloading: { titleKey: "update.downloading", descriptionKey: "update.downloadDescription" },
  preparingInstall: { titleKey: "update.preparing", descriptionKey: "update.restartingDescription" },
  error: { titleKey: "update.statusError", descriptionKey: "update.retryDescription" },
};

const PHASE_ICONS: Record<UpdatePhase, LucideIcon> = {
  initializing: RefreshCw,
  ready: LoaderCircle,
  checking: RefreshCw,
  upToDate: ShieldCheck,
  readyToInstall: Download,
  downloading: Download,
  preparingInstall: LoaderCircle,
  error: CircleAlert,
};

const SPINNING_PHASES = new Set<UpdatePhase>(["initializing", "checking"]);
const DISABLED_PHASES = new Set<UpdatePhase>(["initializing", "checking", "downloading", "preparingInstall"]);
const BUTTON_ACTIONS: Record<UpdatePhase, "check" | "install"> = {
  initializing: "check",
  ready: "check",
  checking: "check",
  upToDate: "check",
  readyToInstall: "install",
  downloading: "install",
  preparingInstall: "install",
  error: "check",
};

const BUTTON_LABELS: Record<UpdatePhase, TranslationKey> = {
  initializing: "update.checking",
  ready: "update.check",
  checking: "update.checking",
  upToDate: "update.check",
  readyToInstall: "update.install",
  downloading: "update.downloading",
  preparingInstall: "update.preparing",
  error: "common.retry",
};

export function UpdateStatusCard({ phase, info, currentVersion, checkedAt, error, onCheck, onInstall }: UpdateStatusCardProps) {
  const { t } = useTranslation();
  const copy = STATUS_COPY[phase];
  const Icon = PHASE_ICONS[phase];
  const checkedText = formatCheckedAt(checkedAt);
  const title = phase === "readyToInstall" && info ? t(copy.titleKey, { version: info.version }) : t(copy.titleKey);
  const description = error ?? t(copy.descriptionKey);

  return (
    <section className="rounded-lg border border-border bg-bg-primary p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bg-secondary text-text-secondary">
          <Icon size={18} className={SPINNING_PHASES.has(phase) ? "animate-spin" : undefined} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
        </div>
        <UpdateButton phase={phase} info={info} t={t} onCheck={onCheck} onInstall={onInstall} />
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-border pt-3 text-xs sm:grid-cols-2">
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-text-secondary">{t("update.currentVersion")}</dt>
          <dd className="text-text-primary">{currentVersion ? `v${currentVersion}` : "—"}</dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-text-secondary">{t("update.lastChecked")}</dt>
          <dd className="text-text-primary">{checkedText ?? "—"}</dd>
        </div>
      </dl>
    </section>
  );
}

interface UpdateButtonProps {
  phase: UpdatePhase;
  info: UpdateInfo | null;
  t: ReturnType<typeof useTranslation>["t"];
  onCheck: () => Promise<unknown>;
  onInstall: () => Promise<void>;
}

function UpdateButton({ phase, info, t, onCheck, onInstall }: UpdateButtonProps) {
  const disabled = DISABLED_PHASES.has(phase);
  const label = phase === "readyToInstall" && info
    ? t(BUTTON_LABELS[phase], { version: info.version })
    : t(BUTTON_LABELS[phase]);

  return (
    <Button
      variant={phase === "readyToInstall" ? "primary" : "ghost"}
      className="shrink-0 border border-border text-xs"
      disabled={disabled}
      onClick={() => void (BUTTON_ACTIONS[phase] === "install" ? onInstall() : onCheck())}
    >
      {label}
    </Button>
  );
}
