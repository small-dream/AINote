import { useCallback, useEffect, useState } from "react";
import { captureApi, messageOf, type CaptureSettings } from "@/api";

/** 设置页快捷键读取、保存与恢复默认；失败时回显后端保留的旧值。 */
export function useCaptureSettings() {
  const [settings, setSettings] = useState<CaptureSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSettings(await captureApi.getSettings());
      setError(null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const run = async (operation: () => Promise<CaptureSettings>) => {
    setSaving(true);
    setError(null);
    try {
      setSettings(await operation());
      return true;
    } catch (err) {
      setError(messageOf(err));
      await load();
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    settings, loading, saving, error,
    save: (shortcut: string) => run(() => captureApi.setShortcut(shortcut)),
    reset: () => run(() => captureApi.resetShortcut()),
  };
}
