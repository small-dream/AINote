import { Loader2, Mic, Square } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import { useTranslation } from "@/i18n";
import type { VoiceStatus } from "../hooks/useVoiceInput";

interface VoiceMicButtonProps {
  status: VoiceStatus;
  partial: string;
  onToggle: () => void;
}

/**
 * 编辑器工具栏的麦克风入口。
 * 识别中以胶囊形态展示实时转写（截断防溢出），点击即停止并定稿。
 */
export function VoiceMicButton({ status, partial, onToggle }: VoiceMicButtonProps) {
  const { t } = useTranslation();
  if (status === "idle") {
    return (
      <IconButton icon={Mic} label={t("voice.mic")} size="md" tooltipPlacement="bottom" tooltipPortal className="voice-mic-button h-11 w-11" onClick={onToggle} />
    );
  }
  return (
    <button
      type="button"
      aria-label={t("voice.listening")}
      onClick={onToggle}
      className="voice-listening-button flex h-11 min-w-0 max-w-52 shrink items-center gap-1.5 rounded-md border border-accent/40 bg-accent-soft px-3 text-xs text-accent transition-colors active:scale-[0.97]"
    >
      {status === "starting" ? (
        <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
      )}
      <span className="min-w-0 truncate">{partial || t("voice.listening")}</span>
      <Square size={12} className="shrink-0" aria-hidden="true" />
    </button>
  );
}
