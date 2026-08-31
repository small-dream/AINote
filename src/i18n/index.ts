import { useCallback } from "react";
import { useUiStore, type Locale } from "@/stores/ui.store";
import { messages, type TranslationKey } from "./messages";

export function translate(locale: Locale, key: TranslationKey, values: Record<string, string | number> = {}): string {
  return messages[locale][key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ""));
}

export function useTranslation() {
  const locale = useUiStore((state) => state.locale);
  const t = useCallback((key: TranslationKey, values?: Record<string, string | number>) => translate(locale, key, values), [locale]);
  return { locale, t };
}
