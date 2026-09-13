import { useState } from "react";
import { BindRepoForm } from "./BindRepoForm";
import { CreateRepoForm } from "./CreateRepoForm";
import { useTranslation } from "@/i18n";

interface RepoSetupProps {
  onBound: (repoPath: string) => void;
  /** 缺少目标平台凭证时交回上层，由上层引导登录后回到这里 */
  onNeedLogin?: ((input: { providerId: string; repoUrl?: string }) => void) | undefined;
  /** 登录返回后恢复上次填写的仓库地址 */
  initialUrl?: string | undefined;
}

type Mode = "bind" | "create";

/** 仓库设置：绑定已有 / 新建，二选一 */
export function RepoSetup({ onBound, onNeedLogin, initialUrl }: RepoSetupProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("bind");

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">{t("repo.setup")}</h1>
      <div className="mb-6 flex overflow-hidden rounded-md border border-bg-secondary text-sm">
        <button
          className={`flex-1 px-3 py-1.5 ${mode === "bind" ? "bg-accent text-white" : "text-text-secondary"}`}
          onClick={() => setMode("bind")}
        >
          {t("repo.bindExisting")}
        </button>
        <button
          className={`flex-1 px-3 py-1.5 ${mode === "create" ? "bg-accent text-white" : "text-text-secondary"}`}
          onClick={() => setMode("create")}
        >
          {t("repo.create")}
        </button>
      </div>
      {mode === "bind" ? (
        <BindRepoForm onBound={onBound} onNeedLogin={onNeedLogin} initialUrl={initialUrl} />
      ) : (
        <CreateRepoForm onBound={onBound} onNeedLogin={onNeedLogin} />
      )}
    </div>
  );
}
