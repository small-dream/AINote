import { useState, type FormEvent } from "react";
import { messageOf } from "@/api";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { useMoveNoteMutation } from "@/queries/note.queries";
import { getDirectoryPath } from "@/features/file-tree/utils/path";
import { noteDisplayName } from "../utils/displayName";
import { joinNotePath, normalizeNotePath } from "../utils/path";
import { noteKindOfPath } from "../utils/noteKind";
import { useTranslation } from "@/i18n";

interface Props { path: string | null; onClose: () => void; onRenamed: (to: string) => void; }

/** 仅修改当前目录中的文件名，目录移动由 MoveNoteDialog 独立处理。 */
export function RenameNoteDialog({ path, onClose, onRenamed }: Props) {
  const { t } = useTranslation();
  const move = useMoveNoteMutation();
  const [name, setName] = useState(path ? noteDisplayName(path.split("/").at(-1) ?? path) : "");
  const [error, setError] = useState<string | null>(null);
  const kind = path ? noteKindOfPath(path) : "markdown";

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = buildRenameTarget(path, name, kind);
    if (result.error) { setError(t("note.nameRequired")); return; }
    if (result.to === path) { onClose(); return; }
    move.mutate({ from: path as string, to: result.to as string }, { onSuccess: () => { onRenamed(result.to as string); onClose(); } });
  }

  return <Modal open={path !== null} title={t("note.renameTitle")} onClose={move.isPending ? () => undefined : onClose}>
    <RenameNoteForm path={path} name={name} error={error} pending={move.isPending} mutateError={move.isError ? messageOf(move.error) : null} onChange={(value) => { setName(value); setError(null); }} onSubmit={submit} onClose={onClose} />
  </Modal>;
}

interface RenameNoteFormProps { path: string | null; name: string; error: string | null; pending: boolean; mutateError: string | null; onChange: (value: string) => void; onSubmit: (event: FormEvent) => void; onClose: () => void; }

function RenameNoteForm({ path, name, error, pending, mutateError, onChange, onSubmit, onClose }: RenameNoteFormProps) {
  const { t } = useTranslation();
  return <form onSubmit={onSubmit}>
    <p className="mb-3 text-xs text-text-secondary">{t("note.renameHint", { path: getDirectoryPath(path ?? "") || t("tree.allNotes") })}</p>
    <input autoFocus className="mb-2 w-full rounded-md border border-bg-secondary bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent" value={name} onChange={(event) => onChange(event.target.value)} />
    {error && <p className="mb-2 text-xs text-danger">{error}</p>}
    {mutateError && <p className="mb-2 text-xs text-danger">{mutateError}</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose} disabled={pending}>{t("common.cancel")}</Button><Button type="submit" variant="primary" disabled={pending}>{pending ? t("common.saving") : t("common.confirm")}</Button></div>
  </form>;
}

function buildRenameTarget(path: string | null, name: string, kind: "markdown" | "richText"): { to: string | null; error: boolean } {
  if (!path || !name.trim() || name.includes("/")) return { to: null, error: true };
  const fileName = normalizeNotePath(name, kind);
  return fileName ? { to: joinNotePath(getDirectoryPath(path), fileName), error: false } : { to: null, error: true };
}
