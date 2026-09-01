import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router";
import { AppProviders } from "@/app/providers";
import { router } from "@/app/router";
import { readStoredLocale, readStoredTheme } from "@/stores/ui.store";
import "@/styles/index.css";
import "@/features/richtext/rich-text.css";

// 在 React 渲染前写入 data-theme，避免暗色偏好下首屏闪烁
document.documentElement.dataset.theme = readStoredTheme();
document.documentElement.lang = readStoredLocale();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </React.StrictMode>
);
