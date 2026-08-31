import { type FormEvent } from "react";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { useNewFolderForm } from "../hooks/useNewFolderForm";
import { normalizeFolderPath } from "../utils/path";
import { useTranslation } from "@/i18n";

interface NewFolderDialogProps {
  open: boolean;
  dir: string;
  existingDirs: ReadonlySet<string>;
  onClose: () => void;
  onCreate: (path: string) => Promise<void>;
}

/** 新建文件夹：输入目录路径（可含父目录）；创建成功后由父组件关闭（P0-3） */
export function NewFolderDialog({ open, dir, existingDirs, onClose, onCreate }: NewFolderDialogProps) {
  const { t } = useTranslation();
  const { path, error, pending, changePath, submit } = useNewFolderForm(dir, onCreate);
  const normalizedDraft = normalizeFolderPath(path);
  const duplicate =
    normalizedDraft !== null &&
    normalizedDraft !== dir &&
    existingDirs.has(normalizedDraft);

  return (
    <Modal open={open} title={t("tree.newFolder")} onClose={onClose}>
      <FolderForm
        path={path}
        pending={pending}
        error={error}
        duplicate={duplicate}
        onCancel={onClose}
        onPathChange={changePath}
        onSubmit={submit}
      />
    </Modal>
  );
}

interface FolderFormProps {
  path: string;
  pending: boolean;
  error: string | null;
  duplicate: boolean;
  onCancel: () => void;
  onPathChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}

function FolderForm({
  path,
  pending,
  error,
  duplicate,
  onCancel,
  onPathChange,
  onSubmit,
}: FolderFormProps) {
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit}>
      <input
        autoFocus
        className="mb-2 w-full rounded-md border border-bg-secondary bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent"
        placeholder={t("tree.folderPath")}
        value={path}
        onChange={(e) => onPathChange(e.target.value)}
      />
      {duplicate && (
        <p className="mb-2 text-xs text-warning">{t("tree.folderExists")}</p>
      )}
      {error && <p className="mb-2 text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? t("common.creating") : t("common.create")}
        </Button>
      </div>
    </form>
  );
}
