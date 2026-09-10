import { createBrowserRouter, Navigate } from "react-router";
import { lazy, Suspense } from "react";
import { useSessionStore } from "@/stores/session.store";
import { useTranslation } from "@/i18n";

const LazySetupPage = lazy(() => import("@/pages/setup").then(({ SetupPage }) => ({ default: SetupPage })));
const LazyWorkspacePage = lazy(() => import("@/pages/workspace").then(({ WorkspacePage }) => ({ default: WorkspacePage })));

/** 工作区路由：仓库切换（workspaceEpoch 变化）时整页重挂载以加载新仓库 */
function WorkspaceRoute() {
  const epoch = useSessionStore((s) => s.workspaceEpoch);
  return <LazyWorkspacePage key={epoch} />;
}

function RouteLoading() {
  const { t } = useTranslation();
  return (
    <div data-tauri-drag-region className="flex h-screen items-center justify-center text-sm text-text-secondary">
      {t("common.loading")}
    </div>
  );
}

export const router = createBrowserRouter([
  { path: "/setup", element: <Suspense fallback={<RouteLoading />}><LazySetupPage /></Suspense> },
  { path: "/workspace", element: <Suspense fallback={<RouteLoading />}><WorkspaceRoute /></Suspense> },
  { path: "*", element: <Navigate to="/workspace" replace /> },
]);
