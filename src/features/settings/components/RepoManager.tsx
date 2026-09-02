import { useState, type ReactNode } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import type { RepoInfo } from "@/api/types";
import { Button } from "@/components/atoms/Button";
import { useSessionStore } from "@/stores/session.store";
import { useRepoManager } from "../hooks/useRepoManager";
import { AddRepoDialog } from "./AddRepoDialog";
import { RemoveRepoDialog } from "./RemoveRepoDialog";
import { RenameRepoDialog } from "./RenameRepoDialog";
import { useTranslation } from "@/i18n";

/** 设置页仓库管理内容区：列表 + 添加/设为当前/重命名/移除（标题由设置视图统一提供） */
export function RepoManager() {
  const { repos, rename, remove, activate, handleAdded } = useRepoManager();
  const activePath = useSessionStore((s) => s.repoPath);
  const [addOpen, setAddOpen] = useState(false);
  const [renaming, setRenaming] = useState<RepoInfo | null>(null);
  const [removing, setRemoving] = useState<RepoInfo | null>(null);
  return (<div className="flex flex-col gap-3">
      <RepoToolbar count={repos.length} onAdd={() => setAddOpen(true)} />
      <ul className="space-y-2">
        {repos.length === 0 ? (
          <EmptyRepos />
        ) : (
          repos.map((repo) => (
            <RepoRow
              key={repo.id}
              repo={repo}
              isActive={repo.path === activePath}
              activating={activate.isPending}
              onActivate={() => activate.mutate(repo.id)}
              onRename={() => setRenaming(repo)}
              onRemove={() => setRemoving(repo)}
            />
          ))
        )}
      </ul>
      <RepoDialogs
        addOpen={addOpen}
        renaming={renaming}
        removing={removing}
        onCloseAdd={() => setAddOpen(false)}
        onCloseRename={() => setRenaming(null)}
        onCloseRemove={() => setRemoving(null)}
        onAdded={handleAdded}
        onRename={async (id, name) => { await rename.mutateAsync({ id, name }); }}
        onRemove={async (id) => { await remove.mutateAsync(id); }}
      />
    </div>);
}

function RepoToolbar({ count, onAdd }: { count: number; onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-tertiary">{t("repo.count", { count })}</span>
      <Button type="button" variant="ghost" className="inline-flex items-center gap-1 border border-border text-xs" onClick={onAdd}>
        <Plus size={14} />
        {t("repo.add")}
      </Button>
    </div>
  );
}

function RepoDialogs(props: RepoDialogsProps) {
  return (
    <>
      <AddRepoDialog open={props.addOpen} onClose={props.onCloseAdd} onAdded={props.onAdded} />
      <RenameRepoDialog key={props.renaming?.id ?? "none"} repo={props.renaming} onClose={props.onCloseRename} onSubmit={props.onRename} />
      <RemoveRepoDialog key={props.removing?.id ?? "none"} repo={props.removing} onClose={props.onCloseRemove} onConfirm={props.onRemove} />
    </>
  );
}

interface RepoDialogsProps {
  addOpen: boolean;
  renaming: RepoInfo | null;
  removing: RepoInfo | null;
  onCloseAdd: () => void;
  onCloseRename: () => void;
  onCloseRemove: () => void;
  onAdded: (path: string) => void;
  onRename: (id: string, name: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

interface RepoRowProps {
  repo: RepoInfo;
  isActive: boolean;
  activating: boolean;
  onActivate: () => void;
  onRename: () => void;
  onRemove: () => void;
}

function RepoRow({ repo, isActive, activating, onActivate, onRename, onRemove }: RepoRowProps) {
  const { t } = useTranslation();
  return (
    <li className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{repo.name}</span>
            {isActive && (
              <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[11px] text-accent">{t("repo.current")}</span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-text-tertiary" title={repo.path}>{repo.path}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!isActive && (
            <IconButton label={t("repo.setCurrent", { name: repo.name })} title={t("repo.setCurrent", { name: repo.name })} disabled={activating} onClick={onActivate}>
              <Check size={15} />
            </IconButton>
          )}
          <IconButton label={t("repo.rename", { name: repo.name })} title={t("repo.rename", { name: repo.name })} onClick={onRename}>
            <Pencil size={15} />
          </IconButton>
          <IconButton label={t("repo.remove", { name: repo.name })} title={t("repo.remove", { name: repo.name })} danger onClick={onRemove}>
            <Trash2 size={15} />
          </IconButton>
        </div>
      </div>
    </li>
  );
}

interface IconButtonProps {
  label: string;
  title: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

function IconButton({ label, title, danger, disabled, onClick, children }: IconButtonProps) {
  const tone = danger ? "hover:text-danger" : "hover:text-text-primary";
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`grid h-7 w-7 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-bg-tertiary disabled:opacity-50 ${tone}`}
    >
      {children}
    </button>
  );
}

function EmptyRepos() {
  const { t } = useTranslation();
  return <li className="py-3 text-center text-xs text-text-tertiary">{t("repo.none")}</li>;
}
