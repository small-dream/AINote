import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, FolderTree, Settings2 } from "lucide-react";
import type { RepoInfo } from "@/api/types";
import { useBackHandler } from "@/platform/back-navigation";
import { useRepoListQuery, useSwitchRepoMutation } from "@/queries/repo.queries";
import { useSessionStore } from "@/stores/session.store";
import { useUiStore } from "@/stores/ui.store";
import { useTranslation } from "@/i18n";

/** 平台展示名（品牌名不翻译）；未知 id 原样展示。 */
const PROVIDER_LABELS: Record<string, string> = { github: "GitHub", gitee: "Gitee" };

/**
 * 目录树顶部的仓库标识 + 切换下拉。
 *
 * 工作区其余部分只呈现"当前仓库"，多仓库时用户无从判断自己在哪个库，
 * 这里常驻显示仓库名与平台，并提供切换入口（与设置页仓库列表共用同一套切换逻辑）。
 */
export function RepoSwitcher() {
  const { t } = useTranslation();
  const repoPath = useSessionStore((s) => s.repoPath);
  const { data: repos = [] } = useRepoListQuery();
  const activate = useSwitchRepoMutation();
  const { open, toggle, close } = useRepoMenu();

  const current = repos.find((repo) => repo.path === repoPath) ?? null;
  const label = current?.name ?? basename(repoPath) ?? t("tree.repoFallback");
  const providerLabel = current?.providerId ? providerName(current.providerId) : null;

  function switchTo(repo: RepoInfo) {
    close();
    if (repo.path === repoPath) return;
    activate.mutate(repo.id);
  }

  return (
    <div className="relative min-w-0" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("tree.switchRepo")}
        title={t("tree.switchRepo")}
        disabled={activate.isPending}
        onClick={toggle}
        className="flex w-full min-w-0 items-center gap-1.5 rounded-md border border-border bg-bg-primary px-2 py-1.5 text-left transition-colors hover:border-accent max-md:min-h-9"
      >
        <FolderTree size={14} className="shrink-0 text-text-tertiary" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-primary">{label}</span>
        {providerLabel && (
          <span className="shrink-0 rounded bg-bg-secondary px-1.5 py-0.5 text-[11px] text-text-tertiary">{providerLabel}</span>
        )}
        <ChevronDown size={13} className="shrink-0 text-text-tertiary" aria-hidden="true" />
      </button>
      {open && (
        <RepoMenu
          repos={repos}
          activePath={repoPath}
          label={t("tree.repoListLabel")}
          manageLabel={t("tree.manageRepos")}
          onSelect={switchTo}
          onManage={() => {
            close();
            useUiStore.getState().openSettings("repositories");
          }}
        />
      )}
    </div>
  );
}

/** 下拉开关：点击空白 / Escape / 系统返回键关闭（与目录右键菜单同一套交互）。 */
function useRepoMenu() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useBackHandler(open, close);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close]);

  return { open, toggle: () => setOpen((value) => !value), close };
}

interface RepoMenuProps {
  repos: RepoInfo[];
  activePath: string | null;
  label: string;
  manageLabel: string;
  onSelect: (repo: RepoInfo) => void;
  onManage: () => void;
}

function RepoMenu({ repos, activePath, label, manageLabel, onSelect, onManage }: RepoMenuProps) {
  return (
    <div
      role="listbox"
      aria-label={label}
      className="absolute inset-x-0 top-full z-30 mt-1 max-h-[min(60dvh,16rem)] overflow-y-auto overscroll-contain rounded-md border border-border bg-bg-primary py-1 shadow-lg"
    >
      {repos.map((repo) => {
        const active = repo.path === activePath;
        return (
          <button
            key={repo.id}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onSelect(repo)}
            className={`flex w-full min-w-0 items-center gap-1.5 px-2 py-1.5 text-left text-xs transition-colors hover:bg-bg-secondary max-md:min-h-9 ${active ? "text-accent" : "text-text-secondary"}`}
          >
            <Check size={13} className={`shrink-0 ${active ? "" : "invisible"}`} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{repo.name}</span>
            {repo.providerId && (
              <span className="shrink-0 text-[11px] text-text-tertiary">{providerName(repo.providerId)}</span>
            )}
          </button>
        );
      })}
      <div className="my-1 border-t border-border" />
      <button
        type="button"
        onClick={onManage}
        className="flex w-full min-w-0 items-center gap-1.5 px-2 py-1.5 text-left text-xs text-text-secondary transition-colors hover:bg-bg-secondary max-md:min-h-9"
      >
        <Settings2 size={13} className="shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{manageLabel}</span>
      </button>
    </div>
  );
}

function providerName(providerId: string): string {
  return PROVIDER_LABELS[providerId] ?? providerId;
}

/** 仓库列表尚未加载时用克隆目录名兜底，避免按钮空白。 */
function basename(path: string | null): string | null {
  if (!path) return null;
  const segment = path.split(/[\\/]/).filter(Boolean).pop();
  return segment ?? null;
}
