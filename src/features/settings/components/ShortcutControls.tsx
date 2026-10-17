import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type Dispatch, type KeyboardEvent, type RefObject, type SetStateAction } from "react";
import { useTranslation } from "@/i18n";
import { useCaptureSettings } from "@/features/capture/hooks/useCaptureSettings";
import { displayShortcut, shortcutFromEvent } from "@/features/capture/utils/shortcut";

type ShortcutControlsProps = ReturnType<typeof useCaptureSettings>;

/** 快捷键录制与保存操作；拆成小块以保持单一组件职责与低圈复杂度。 */
export function ShortcutControls({ settings, saving, error, save, reset }: ShortcutControlsProps) {
  const [recording, setRecording] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const current = draft || settings?.shortcut || "";
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <ShortcutInput recording={recording} setRecording={setRecording} shortcut={current} inputRef={inputRef} onRecord={setDraft} />
        <ShortcutActions saving={saving} draft={draft} current={settings?.shortcut ?? ""} setDraft={setDraft} save={save} reset={reset} />
      </div>
      <ShortcutStatus registered={settings?.registered === true} error={error ?? settings?.error ?? null} />
    </>
  );
}

interface ShortcutInputProps {
  recording: boolean;
  setRecording: Dispatch<SetStateAction<boolean>>;
  shortcut: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onRecord: (shortcut: string) => void;
}

function ShortcutInput({ recording, setRecording, shortcut, inputRef, onRecord }: ShortcutInputProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (recording) inputRef.current?.focus();
  }, [recording, inputRef]);
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    if (event.key === "Escape") {
      setRecording(false);
      return;
    }
    const next = shortcutFromEvent(event.nativeEvent);
    if (next) {
      onRecord(next);
      setRecording(false);
    }
  };
  return (
    <input
      ref={inputRef}
      readOnly
      value={inputValue(recording, shortcut, t("capture.recording"), t("capture.notSet"))}
      onFocus={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={onKeyDown}
      aria-label={t("capture.shortcutTitle")}
      className="h-9 min-w-[240px] rounded-md border border-border bg-bg-primary px-3 text-sm outline-none focus:border-accent"
    />
  );
}

function inputValue(recording: boolean, shortcut: string, recordingLabel: string, unsetLabel: string): string {
  if (recording) return recordingLabel;
  return shortcut ? displayShortcut(shortcut) : unsetLabel;
}

interface ShortcutActionsProps {
  saving: boolean;
  draft: string;
  current: string;
  setDraft: Dispatch<SetStateAction<string>>;
  save: ShortcutControlsProps["save"];
  reset: ShortcutControlsProps["reset"];
}

function ShortcutActions({ saving, draft, current, setDraft, save, reset }: ShortcutActionsProps) {
  const { t } = useTranslation();
  const saveDraft = () => {
    void save(draft).then((ok) => {
      if (ok) setDraft("");
    });
  };
  const resetShortcut = () => {
    void reset().then(() => setDraft(""));
  };
  return (
    <>
      <button type="button" disabled={saving || !draft || draft === current} onClick={saveDraft} className="rounded-md bg-accent px-3 py-2 text-sm text-white disabled:opacity-50">{t("common.save")}</button>
      <button type="button" disabled={saving} onClick={resetShortcut} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary disabled:opacity-50"><RotateCcw size={13} />{t("capture.reset")}</button>
    </>
  );
}

function ShortcutStatus({ registered, error }: { registered: boolean; error: string | null }) {
  const { t } = useTranslation();
  return (
    <>
      <p className={`text-xs ${registered ? "text-success" : "text-warning"}`}>{registered ? t("capture.registered") : t("capture.unavailable")}</p>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </>
  );
}
