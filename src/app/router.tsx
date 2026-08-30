import { createBrowserRouter, Navigate } from "react-router";
import { SetupPage } from "@/pages/setup";
import { WorkspacePage } from "@/pages/workspace";

export const router = createBrowserRouter([
  { path: "/setup", element: <SetupPage /> },
  { path: "/workspace", element: <WorkspacePage /> },
  { path: "*", element: <Navigate to="/workspace" replace /> },
]);
