import { useMemo, useState } from "react";
import { Clock3, Search } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import type { RecentNote } from "@/features/recent/utils/recent";
import { useNoteListQuery } from "@/queries/note.queries";
import { useSessionStore } from "@/stores/session.store";
import { useUiStore } from "@/stores/ui.store";
import { useTranslation } from "@/i18n";
import { filterRecentNotes, groupRecentNotes, sortRecentNotes } from "../utils/recent";

interface RecentPanelProps {
  repoPath: string | null;
  onSelect: (path: string) => void;
}

/** 最近面板：优先显示本机打开顺序，补充最近修改笔记，支持快速过滤。 */
export function RecentPanel({ repoPath, onSelect }: RecentPanelProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const { data: notes = [], isLoading } = useNoteListQuery(repoPath);
  const recentEntries = useUiStore((state) => repoPath ? state.recentNotes[repoPath] : undefined);
  const clearRecentNotes = useUiStore((state) => state.clearRecentNotes);
  const currentNotePath = useSessionStore((state) => state.currentNotePath);
  const groups = useMemo(() => {
    const recent = sortRecentNotes(notes, recentEntries ?? []);
    return groupRecentNotes(filterRecentNotes(recent, query));
  }, [notes, query, recentEntries]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-border px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{t("app.recent")}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary">{notes.length}</span>
            {notes.length > 0 && (
              <Button variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => clearRecentNotes(repoPath ?? "")}>
                {t("recent.clear")}
              </Button>
            )}
          </div>
        </div>
        <RecentSearch value={query} onChange={setQuery} />
      </header>
      <RecentList groups={groups} isLoading={isLoading} currentNotePath={currentNotePath} onSelect={onSelect} />
    </div>
  );
}

function RecentSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  return (
    <label className="mt-2 flex items-center gap-2 rounded-md border border-border bg-bg-primary px-2 py-1.5">
      <Search size={14} className="shrink-0 text-text-tertiary" aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("recent.search")}
        aria-label={t("recent.search")}
        className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
      />
    </label>
  );
}

interface RecentListProps {
  groups: ReturnType<typeof groupRecentNotes>;
  isLoading: boolean;
  currentNotePath: string | null;
  onSelect: (path: string) => void;
}

function RecentList({ groups, isLoading, currentNotePath, onSelect }: RecentListProps) {
  const { t } = useTranslation();
  if (isLoading) return <p className="p-4 text-sm text-text-secondary">{t("common.loading")}</p>;
  if (groups.length === 0) return <RecentEmptyState />;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
      {groups.map(({ key, notes }) => (
        <section key={key} className="mb-3">
          <h3 className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            {t(`recent.${key}`)}
          </h3>
          {notes.map((note) => (
            <RecentNoteRow key={note.path} note={note} active={note.path === currentNotePath} onSelect={onSelect} />
          ))}
        </section>
      ))}
    </div>
  );
}

function RecentEmptyState() {
  const { t } = useTranslation();
  return (
    <div className="mx-3 mt-6 rounded-lg border border-dashed border-border px-4 py-6 text-center">
      <Clock3 size={20} className="mx-auto text-text-tertiary" aria-hidden="true" />
      <p className="mt-2 text-sm font-medium text-text-primary">{t("recent.none")}</p>
      <p className="mt-1 text-xs leading-5 text-text-secondary">{t("recent.hint")}</p>
    </div>
  );
}

function RecentNoteRow({ note, active, onSelect }: { note: RecentNote; active: boolean; onSelect: (path: string) => void }) {
  const { locale } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => onSelect(note.path)}
      aria-current={active ? "true" : undefined}
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${
        active ? "bg-accent-soft text-accent" : "text-text-primary hover:bg-bg-tertiary"
      }`}
    >
      <Clock3 size={14} className="shrink-0 text-text-tertiary" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{note.title || note.path.split("/").pop()}</span>
        <span className="mt-0.5 block truncate text-[11px] text-text-tertiary">{note.path}</span>
      </span>
      <time dateTime={new Date(note.openedAt).toISOString()} className="shrink-0 text-[11px] text-text-tertiary">
        {formatOpenedAt(note.openedAt, locale)}
      </time>
    </button>
  );
}

function formatOpenedAt(timestamp: number, locale: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric" }).format(date);
}
