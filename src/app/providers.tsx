import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { useUiStore } from "@/stores/ui.store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5_000 },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeApplier />
      {children}
    </QueryClientProvider>
  );
}

/** 全局 UI 态：将 theme 写入 <html data-theme>，驱动 tokens.css 明暗切换 */
function ThemeApplier() {
  const theme = useUiStore((s) => s.theme);
  const locale = useUiStore((s) => s.locale);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
