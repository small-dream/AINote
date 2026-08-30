import { useNavigate } from "react-router";
import { Button } from "@/components/atoms/Button";

/** 首次启动：绑定 GitHub 笔记仓库（P0-1 的 UI 壳，逻辑待 repo feature 实现） */
export function SetupPage() {
  const navigate = useNavigate();
  return (
    <div className="flex h-screen items-center justify-center bg-bg-secondary">
      <div className="w-full max-w-md rounded-lg bg-bg-primary p-8 shadow">
        <h1 className="mb-2 text-2xl font-semibold">欢迎使用 MyNote</h1>
        <p className="mb-6 text-text-secondary">
          绑定一个 GitHub 仓库作为你的笔记库，数据完全由你掌控。
        </p>
        <Button onClick={() => navigate("/workspace")}>连接 GitHub 仓库</Button>
      </div>
    </div>
  );
}
