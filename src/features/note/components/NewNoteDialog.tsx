import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import type { NewNoteInput } from "../types";
import { useNewNoteForm } from "../hooks/useNewNoteForm";
import { normalizeNotePath } from "../utils/path";
import type { NoteTemplate } from "../utils/template";

interface NewNoteDialogProps {
  open: boolean;
  dir: string;
  existingPaths: ReadonlySet<string>;
  onClose: () => void;
  onCreate: (input: NewNoteInput) => Promise<void>;
}

const TEMPLATE_OPTIONS: { value: NoteTemplate; label: string }[] = [
  { value: "default", label: "默认（# 未命名）" },
  { value: "daily", label: "每日（日期标题）" },
  { value: "blank", label: "空白" },
];

/** 新建笔记：路径（可含目录）+ 模板选择；创建成功后由父组件关闭（P0-2） */
export function NewNoteDialog({ open, dir, existingPaths, onClose, onCreate }: NewNoteDialogProps) {
  const { template, path, error, pending, changePath, changeTemplate, submit } = useNewNoteForm(
    dir,
    onCreate
  );
  const normalizedDraft = normalizeNotePath(path);
  const duplicate = normalizedDraft !== null && existingPaths.has(normalizedDraft);

  return (
    <Modal open={open} title="新建笔记" onClose={onClose}>
      <NoteForm
        path={path}
        template={template}
        pending={pending}
        error={error}
        duplicate={duplicate}
        onCancel={onClose}
        onPathChange={changePath}
        onTemplateChange={changeTemplate}
        onSubmit={submit}
      />
    </Modal>
  );
}

interface NoteFormProps {
  path: string;
  template: NoteTemplate;
  pending: boolean;
  error: string | null;
  duplicate: boolean;
  onCancel: () => void;
  onPathChange: (value: string) => void;
  onTemplateChange: (next: NoteTemplate) => void;
  onSubmit: (event: React.FormEvent) => void;
}

function NoteForm({
  path,
  template,
  pending,
  error,
  duplicate,
  onCancel,
  onPathChange,
  onTemplateChange,
  onSubmit,
}: NoteFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <input
        autoFocus
        className="mb-2 w-full rounded-md border border-bg-secondary bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent"
        placeholder="如：daily/我的笔记（自动补 .md）"
        value={path}
        onChange={(e) => onPathChange(e.target.value)}
      />
      <TemplatePicker template={template} onChange={onTemplateChange} />
      {duplicate && (
        <p className="mb-2 text-xs text-warning">已存在同名笔记，创建将打开已有文件</p>
      )}
      {error && <p className="mb-2 text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          取消
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "创建中…" : "创建"}
        </Button>
      </div>
    </form>
  );
}

function TemplatePicker({
  template,
  onChange,
}: {
  template: NoteTemplate;
  onChange: (next: NoteTemplate) => void;
}) {
  return (
    <fieldset className="mb-2 flex flex-wrap gap-3 text-sm">
      <legend className="sr-only">模板</legend>
      {TEMPLATE_OPTIONS.map((opt) => (
        <label key={opt.value} className="flex items-center gap-1">
          <input
            type="radio"
            name="note-template"
            value={opt.value}
            checked={template === opt.value}
            onChange={() => onChange(opt.value)}
          />
          {opt.label}
        </label>
      ))}
    </fieldset>
  );
}
