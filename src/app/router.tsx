import { createBrowserRouter, Navigate } from "react-router";
import { SetupPage } from "@/pages/setup";
import { WorkspacePage } from "@/pages/workspace";
import { useSessionStore } from "@/stores/session.store";

/** 工作区路由：仓库切换（workspaceEpoch 变化）时整页重挂载以加载新仓库 */
function WorkspaceRoute() {
  const epoch = useSessionStore((s) => s.workspaceEpoch);
  return <WorkspacePage key={epoch} />;
}

export const router = createBrowserRouter([
  { path: "/setup", element: <SetupPage /> },
  { path: "/workspace", element: <WorkspaceRoute /> },
  { path: "*", element: <Navigate to="/workspace" replace /> },
]);
