import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { captureApi, messageOf, type NoteMeta, type SharedCapture } from "@/api";
import { isTauriRuntime } from "@/api/back-button.api";
import { useToastStore } from "@/stores/toast.store";
import { useTranslation } from "@/i18n";

function parseTags(value: string): string[] {
  return value.split(/[,，\s]+/).map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean);
}

function isUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value);
}

function useCaptureForm() {
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [link, setLink] = useState("");
  const [share, setShare] = useState<SharedCapture | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reset = useCallback(() => {
    setText(""); setTags(""); setLink(""); setShare(null); setError(null);
  }, []);
  return { text, tags, link, share, saving, error, reset, setText, setTags, setLink, setShare, setSaving, setError };
}

/** 启动与重新聚焦时恢复 Android 待确认分享；取消只在本进程忽略，下次启动仍可恢复。 */
function usePendingShare(onOpen: (item: SharedCapture) => void, onError: (message: string) => void) {
  const dismissed = useRef(new Set<string>());
  const pendingId = useRef<string | null>(null);
  const checkPending = useCallback(async () => {
    if (!isTauriRuntime()) return;
    try {
      const item = await captureApi.pendingShare();
      if (!item || dismissed.current.has(item.id)) return;
      pendingId.current = item.id;
      onOpen(item);
    } catch (err) {
      onError(messageOf(err));
    }
  }, [onError, onOpen]);

  useEffect(() => {
    const initial = window.setTimeout(() => { void checkPending(); }, 0);
    const onFocus = () => { void checkPending(); };
    const onVisible = () => { if (document.visibilityState === "visible") void checkPending(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [checkPending]);

  const dismiss = useCallback(() => {
    if (pendingId.current) dismissed.current.add(pendingId.current);
  }, []);
  return { dismiss };
}

interface SubmitOptions {
  repoPath: string | null;
  text: string;
  tags: string;
  link: string;
  share: SharedCapture | null;
  saving: boolean;
  reset: () => void;
  close: () => void;
  setSaving: (value: boolean) => void;
  setError: (value: string | null) => void;
  onCaptured: (note: NoteMeta) => void;
  emptyMessage: string;
  savedMessage: string;
  openLabel: string;
}

function useCaptureSubmit(options: SubmitOptions) {
  const queryClient = useQueryClient();
  const { repoPath, text, tags, link, share, saving, reset, close, setSaving, setError, onCaptured } = options;
  return useCallback(async () => {
    if (!repoPath || saving) return;
    if (!text.trim() && !link.trim() && !share?.imagePath) {
      setError(options.emptyMessage);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const note = await captureApi.create({ text, tags: parseTags(tags), link: link.trim() || null, shareIntakeId: share?.id ?? null });
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["tree"] });
      void queryClient.invalidateQueries({ queryKey: ["wiki"] });
      void queryClient.invalidateQueries({ queryKey: ["sync"] });
      reset();
      close();
      useToastStore.getState().push(options.savedMessage, "success", 8000, { label: options.openLabel, run: () => onCaptured(note) });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }, [repoPath, text, tags, link, share, saving, reset, close, setSaving, setError, onCaptured, queryClient, options]);
}

/** 快速捕捉状态：全局事件、Android 待处理分享、保存与错误保留。 */
export function useCaptureController(repoPath: string | null, onCaptured: (note: NoteMeta) => void) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const form = useCaptureForm();
  const { text, tags, link, share, saving, error, reset, setText, setTags, setLink, setShare, setSaving, setError } = form;

  const openShare = useCallback((item: SharedCapture) => {
    const original = item.text.trim();
    if (isUrl(original)) { setLink(original); setText(""); } else setText(item.text);
    setShare(item);
    setError(null);
    setOpen(true);
  }, [setError, setLink, setShare, setText]);
  const { dismiss } = usePendingShare(openShare, setError);
  const close = useCallback(() => { dismiss(); setOpen(false); }, [dismiss]);
  const openFresh = useCallback(() => { reset(); setOpen(true); }, [reset]);

  useEffect(() => {
    if (!isTauriRuntime()) return undefined;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/event").then(({ listen }) => listen("capture:open", openFresh))
      .then((fn) => { if (disposed) fn(); else unlisten = fn; })
      .catch(() => undefined);
    return () => { disposed = true; unlisten?.(); };
  }, [openFresh]);

  const save = useCaptureSubmit({
    repoPath, text, tags, link, share, saving, reset, close, setSaving, setError, onCaptured,
    emptyMessage: t("capture.empty"), savedMessage: t("capture.saved"), openLabel: t("capture.openNote"),
  });
  return { open, text, tags, link, share, saving, error, openFresh, close, save, setText, setTags, setLink };
}
