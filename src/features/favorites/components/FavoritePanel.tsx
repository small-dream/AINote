import { Star } from "lucide-react";
import { useFavoriteNotesQuery } from "@/queries/favorite.queries";
import { useTranslation } from "@/i18n";
import { favoriteDisplayName } from "../utils/favorites";

interface FavoritePanelProps {
  repoPath: string | null;
  onSelect: (path: string) => void;
}

/** 侧边栏收藏面板：最近收藏优先展示并打开笔记（P1-13）。 */
export function FavoritePanel({ repoPath, onSelect }: FavoritePanelProps) {
  const { t } = useTranslation();
  const { data: favorites = [], isLoading } = useFavoriteNotesQuery(repoPath);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
          {t("app.favorites")}
        </span>
        <span className="text-xs text-text-tertiary">{favorites.length}</span>
      </header>
      {isLoading ? (
        <p className="p-4 text-sm text-text-secondary">{t("common.loading")}</p>
      ) : favorites.length === 0 ? (
        <div className="mx-3 mt-6 rounded-lg border border-dashed border-border px-4 py-6 text-center">
          <Star size={20} className="mx-auto text-text-tertiary" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-text-primary">{t("favorites.none")}</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">{t("favorites.hint")}</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {favorites.map((note) => (
            <button
              key={note.path}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-text-primary transition-colors hover:bg-bg-tertiary"
              onClick={() => onSelect(note.path)}
            >
              <Star size={15} className="shrink-0 text-warning" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{favoriteDisplayName(note)}</span>
                <span className="mt-0.5 block truncate text-[11px] text-text-tertiary">{note.path}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
