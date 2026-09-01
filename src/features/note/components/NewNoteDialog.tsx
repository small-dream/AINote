import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import type { NoteKind } from "@/api/types";
import type { NewNoteInput } from "../types";
import { useNewNoteForm } from "../hooks/useNewNoteForm";
import { normalizeNotePath } from "../utils/path";
import type { NoteTemplate } from "../utils/template";
import { useTranslation } from "@/i18n";

interface NewNoteDialogProps {
  open: boolean;
  dir: string;
  existingPaths: ReadonlySet<string>;
  onClose: () => void;
  onCreate: (input: NewNoteInput) => Promise<void>;
}

const TEMPLATE_OPTIONS: { value: NoteTemplate; labelKey: "note.defaultTemplate" | "note.dailyTemplate" | "note.blankTemplate" }[] = [
  { value: "default", labelKey: "note.defaultTemplate" },
  { value: "daily", labelKey: "note.dailyTemplate" },
  { value: "blank", labelKey: "note.blankTemplate" },
];

const KIND_OPTIONS: { value: NoteKind; labelKey: "note.markdown" | "note.richText" }[] = [
  { value: "markdown", labelKey: "note.markdown" },
  { value: "richText", labelKey: "note.richText" },
];

/** 新建笔记：类型 + 路径（可含目录）+ 模板选择；创建成功后由父组件关闭（P0-2） */
export function NewNoteDialog({ open, dir, existingPaths, onClose, onCreate }: NewNoteDialogProps) {
  const { t } = useTranslation();
  const { kind, template, path, error, pending, changePath, changeTemplate, changeKind, submit } =
    useNewNoteForm(dir, onCreate);
  const normalizedDraft = normalizeNotePath(path, kind);
  const duplicate = normalizedDraft !== null && existingPaths.has(normalizedDraft);

  return (
    <Modal open={open} title={t("note.newTitle")} onClose={onClose}>
      <NoteForm
        path={path}
        kind={kind}
        template={template}
        pending={pending}
        error={error}
        duplicate={duplicate}
        onCancel={onClose}
        onPathChange={changePath}
        onKindChange={changeKind}
        onTemplateChange={changeTemplate}
        onSubmit={submit}
      />
    </Modal>
  );
}

interface NoteFormProps {
  path: string;
  kind: NoteKind;
  template: NoteTemplate;
  pending: boolean;
  error: string | null;
  duplicate: boolean;
  onCancel: () => void;
  onPathChange: (value: string) => void;
  onKindChange: (next: NoteKind) => void;
  onTemplateChange: (next: NoteTemplate) => void;
  onSubmit: (event: React.FormEvent) => void;
}

function NoteForm({
  path,
  kind,
  template,
  pending,
  error,
  duplicate,
  onCancel,
  onPathChange,
  onKindChange,
  onTemplateChange,
  onSubmit,
}: NoteFormProps) {
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit}>
      <input
        autoFocus
        className="mb-2 w-full rounded-md border border-bg-secondary bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent"
        placeholder={t("note.pathPlaceholder")}
        value={path}
        onChange={(e) => onPathChange(e.target.value)}
      />
      <KindPicker kind={kind} onChange={onKindChange} />
      <TemplatePicker template={template} onChange={onTemplateChange} />
      {duplicate && (
        <p className="mb-2 text-xs text-warning">{t("note.exists")}</p>
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

function KindPicker({ kind, onChange }: { kind: NoteKind; onChange: (next: NoteKind) => void }) {
  const { t } = useTranslation();
  return (
    <fieldset className="mb-2 flex flex-wrap gap-3 text-sm">
      <legend className="sr-only">{t("note.type")}</legend>
      {KIND_OPTIONS.map((opt) => (
        <label key={opt.value} className="flex items-center gap-1">
          <input
            type="radio"
            name="note-kind"
            value={opt.value}
            checked={kind === opt.value}
            onChange={() => onChange(opt.value)}
          />
          {t(opt.labelKey)}
        </label>
      ))}
    </fieldset>
  );
}

function TemplatePicker({
  template,
  onChange,
}: {
  template: NoteTemplate;
  onChange: (next: NoteTemplate) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="mb-2 flex flex-wrap gap-3 text-sm">
      <legend className="sr-only">{t("note.template")}</legend>
      {TEMPLATE_OPTIONS.map((opt) => (
        <label key={opt.value} className="flex items-center gap-1">
          <input
            type="radio"
            name="note-template"
            value={opt.value}
            checked={template === opt.value}
            onChange={() => onChange(opt.value)}
          />
          {t(opt.labelKey)}
        </label>
      ))}
    </fieldset>
  );
}
