import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router";
import { AppProviders } from "@/app/providers";
import { router } from "@/app/router";
import { readStoredLocale, readStoredTheme, resolveTheme } from "@/stores/ui.store";
import "@/styles/index.css";
import "@/features/richtext/rich-text.css";
import "@/features/export/export.css";

// 在 React 渲染前写入 data-theme，避免暗色偏好下首屏闪烁
const prefersDark = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false;
document.documentElement.dataset.theme = resolveTheme(readStoredTheme(), prefersDark);
document.documentElement.lang = readStoredLocale();

async function bootstrap(): Promise<void> {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("e2e")) {
    const { installE2eIpcMock } = await import("@/e2e/ipcMock");
    installE2eIpcMock();
  }
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </React.StrictMode>
  );
}

void bootstrap();
