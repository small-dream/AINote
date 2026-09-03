import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { resolveTheme, useUiStore } from "@/stores/ui.store";
import { useTypographyStore } from "@/stores/typography.store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5_000 },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeApplier />
      <TypographyApplier />
      {children}
    </QueryClientProvider>
  );
}

/** 全局排版偏好：写入 <html> 内联 CSS 变量，覆盖 markdown-themes.css 的默认排版 token。 */
function TypographyApplier() {
  const fontSize = useTypographyStore((s) => s.fontSize);
  const lineHeight = useTypographyStore((s) => s.lineHeight);
  const readingWidth = useTypographyStore((s) => s.readingWidth);
  const fontFamily = useTypographyStore((s) => s.fontFamily);
  useEffect(() => {
    const style = document.documentElement.style;
    style.setProperty("--note-font-size", `${fontSize}px`);
    style.setProperty("--note-line-height", String(lineHeight));
    style.setProperty("--note-reading-width", `${readingWidth}ch`);
    style.setProperty("--note-body-font", fontFamily === "serif" ? "var(--note-body-font-serif)" : "var(--note-body-font-sans)");
  }, [fontSize, lineHeight, readingWidth, fontFamily]);
  return null;
}

/** 全局 UI 态：将解析后的明暗值写入 <html data-theme>，驱动 tokens.css 切换。
 * 「跟随系统」时监听 prefers-color-scheme，切换即时生效。 */
function ThemeApplier() {
  const theme = useUiStore((s) => s.theme);
  const locale = useUiStore((s) => s.locale);
  const [systemDark, setSystemDark] = useState(() => typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    if (theme !== "system" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);
  const resolved = resolveTheme(theme, systemDark);
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
