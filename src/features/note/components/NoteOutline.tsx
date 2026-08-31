import type { OutlineItem } from "../utils/outline";
import { useTranslation } from "@/i18n";

interface NoteOutlineProps {
  items: OutlineItem[];
  onSelect: (item: OutlineItem) => void;
}

export function NoteOutline({ items, onSelect }: NoteOutlineProps) {
  const { t } = useTranslation();
  if (items.length === 0) return <div className="markdown-outline-empty">{t("note.outlineEmpty")}</div>;
  return <nav className="markdown-outline-panel" aria-label={t("note.outline")}>
    <div className="markdown-outline-title">{t("note.outline")}</div>
    <ol>
      {items.map((item) => <li key={`${item.line}-${item.id}`} style={{ paddingLeft: `${(item.level - 1) * 12}px` }}>
        <button type="button" onClick={() => onSelect(item)} title={item.text}>{item.text}</button>
      </li>)}
    </ol>
  </nav>;
}
