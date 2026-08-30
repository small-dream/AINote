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
  onRequestMove: (path: string) => void;
}

/** 侧栏：仓库名 + 登出 + 目录树（新建笔记/文件夹入口） */
export function WorkspaceSidebar({
  repoPath,
  onSelect,
  onRequestNew,
  onRequestFolder,
  onRequestMove,
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
    <aside className="flex min-h-0 w-[248px] shrink-0 flex-col overflow-hidden border-r border-border bg-bg-secondary">
      <SidebarHeader logoutBusy={logoutBusy} onLogout={() => void handleLogout()} />
      <div className="min-h-0 flex-1">
        <FileTree
          repoPath={repoPath}
          onSelect={onSelect}
          onRequestNew={onRequestNew}
          onRequestFolder={onRequestFolder}
          onRequestMove={onRequestMove}
        />
      </div>
    </aside>
  );
}

function SidebarHeader({ logoutBusy, onLogout }: { logoutBusy: boolean; onLogout: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold">我的笔记</p>
        <p className="mt-0.5 truncate text-xs text-text-tertiary">本地知识库</p>
      </div>
      <Button aria-label="退出登录" title="退出登录" variant="ghost" className="px-2 text-xs" onClick={onLogout} disabled={logoutBusy}>
        退出
      </Button>
    </div>
  );
}
