import { useState } from "react";
import { BindRepoForm } from "./BindRepoForm";
import { CreateRepoForm } from "./CreateRepoForm";

interface RepoSetupProps {
  onBound: (repoPath: string) => void;
}

type Mode = "bind" | "create";

/** 仓库设置：绑定已有 / 新建，二选一 */
export function RepoSetup({ onBound }: RepoSetupProps) {
  const [mode, setMode] = useState<Mode>("bind");

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">设置笔记仓库</h1>
      <div className="mb-6 flex overflow-hidden rounded-md border border-bg-secondary text-sm">
        <button
          className={`flex-1 px-3 py-1.5 ${mode === "bind" ? "bg-accent text-white" : "text-text-secondary"}`}
          onClick={() => setMode("bind")}
        >
          绑定已有
        </button>
        <button
          className={`flex-1 px-3 py-1.5 ${mode === "create" ? "bg-accent text-white" : "text-text-secondary"}`}
          onClick={() => setMode("create")}
        >
          新建仓库
        </button>
      </div>
      {mode === "bind" ? (
        <BindRepoForm onBound={onBound} />
      ) : (
        <CreateRepoForm onBound={onBound} />
      )}
    </div>
  );
}
