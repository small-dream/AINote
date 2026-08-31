import { useState } from "react";
import { Modal } from "@/components/molecules/Modal";
import { BindRepoForm } from "@/features/repo/components/BindRepoForm";
import { CreateRepoForm } from "@/features/repo/components/CreateRepoForm";
import { useTranslation } from "@/i18n";

interface AddRepoDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: (repoPath: string) => void;
}

type Mode = "bind" | "create";

/** 设置页「添加仓库」：绑定已有 / 新建二选一（复用 repo 领域表单） */
export function AddRepoDialog({ open, onClose, onAdded }: AddRepoDialogProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("bind");

  return (
    <Modal open={open} title={t("repo.add")} onClose={onClose}>
      <div className="mb-4 flex overflow-hidden rounded-md border border-bg-secondary text-sm">
        <button
          type="button"
          onClick={() => setMode("bind")}
          className={`flex-1 px-3 py-1.5 ${mode === "bind" ? "bg-accent text-white" : "text-text-secondary"}`}
        >
          {t("repo.bindExisting")}
        </button>
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`flex-1 px-3 py-1.5 ${mode === "create" ? "bg-accent text-white" : "text-text-secondary"}`}
        >
          {t("repo.create")}
        </button>
      </div>
      {mode === "bind" ? (
        <BindRepoForm onBound={onAdded} />
      ) : (
        <CreateRepoForm onBound={onAdded} />
      )}
    </Modal>
  );
}
