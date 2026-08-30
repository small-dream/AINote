import { useState } from "react";
import { useNavigate } from "react-router";
import { authApi } from "@/api";
import { Button } from "@/components/atoms/Button";
import { FileTree } from "@/features/file-tree/components/FileTree";
import { useSessionStore } from "@/stores/session.store";

interface WorkspaceSidebarProps {
  repoPath: string | null;
  onSelect: (path: string) => void;
  onRequestNew: (dir: string) => void;
  onRequestFolder: (dir: string) => void;
}

/** 侧栏：仓库名 + 登出 + 目录树（新建笔记/文件夹入口） */
export function WorkspaceSidebar({
  repoPath,
  onSelect,
  onRequestNew,
  onRequestFolder,
}: WorkspaceSidebarProps) {
  const navigate = useNavigate();
  const reset = useSessionStore((s) => s.reset);
  const [logoutBusy, setLogoutBusy] = useState(false);

  async function handleLogout() {
    setLogoutBusy(true);
    try {
      await authApi.logout();
      reset();
      navigate("/setup", { replace: true });
    } finally {
      setLogoutBusy(false);
    }
  }

  return (
    <aside className="flex w-64 flex-col border-r border-bg-secondary bg-bg-secondary">
      <div className="flex items-center justify-between border-b border-bg-secondary px-4 py-2">
        <span className="truncate text-sm font-medium">我的笔记</span>
        <Button variant="ghost" onClick={() => void handleLogout()} disabled={logoutBusy}>
          登出
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <FileTree
          repoPath={repoPath}
          onSelect={onSelect}
          onRequestNew={onRequestNew}
          onRequestFolder={onRequestFolder}
        />
      </div>
    </aside>
  );
}
