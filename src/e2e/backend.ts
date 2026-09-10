/** E2E mock 后端：命令处理器按策略表分发（单一职责，便于 lint 指标达标）。 */
import type { E2eConflictSeed, E2eState } from "./types";

interface MockStore {
  notes: Map<string, { content: string; kind: string }>;
  conflicted: boolean;
  conflicts: E2eConflictSeed[];
  /** 挂起中的同步（模拟退避等待）：取消时用最后一次状态收尾 */
  pendingSync: ((status: unknown) => void) | null;
  /** 本地指标开关与计数（模拟 metrics.json） */
  metricsEnabled: boolean;
  metricsCounts: Record<string, number>;
  /** 近 7 天活跃天数与同步成功率（模拟窗口指标） */
  activeDays: number;
  syncSuccessRate: number | null;
  /** 待提交变更（手动提交入口与面板用） */
  uncommitted: boolean;
  changedFiles: Array<{ path: string; status: "added" | "modified" | "deleted" }>;
}

export interface E2eCommandContext {
  state: E2eState;
  store: MockStore;
}

type CommandHandler = (args: Record<string, unknown>, ctx: E2eCommandContext) => unknown;

/** 与 Rust `domain/metrics.rs` 的 METRIC_EVENTS 一致的事件白名单。 */
const METRIC_EVENT_NAMES = [
  "app_launched",
  "repo_bound",
  "note_created",
  "sync_succeeded",
  "sync_failed",
  "ai_action_confirmed",
  "update_checked",
];

function appError(message: string): { code: string; kind: string; message: string; retriable: boolean } {
  return { code: "UNKNOWN_9001", kind: "Unknown", message, retriable: false };
}

function createStore(state: E2eState): MockStore {
  return {
    notes: new Map(state.notes.map((note) => [note.path, { content: note.content, kind: note.kind ?? "markdown" }])),
    conflicted: state.conflicted === true,
    conflicts: state.conflicts ?? [],
    pendingSync: null,
    metricsEnabled: state.metricsEnabled !== false,
    metricsCounts: { ...(state.metricsCounts ?? {}) },
    activeDays: state.metricsActiveDays ?? 0,
    syncSuccessRate: state.metricsSyncSuccessRate ?? null,
    uncommitted: state.uncommitted === true,
    changedFiles: state.changedFiles ?? [],
  };
}

/** 模拟 Rust 侧经 Tauri Channel 下发重试进度（前端把 Channel 作为参数传入）。 */
function emitSyncProgress(channel: unknown, progress: { retry: number; maxRetries: number; delayMs: number }): void {
  const onmessage = (channel as { onmessage?: (message: unknown) => void } | undefined)?.onmessage;
  onmessage?.({ phase: "retrying", ...progress });
}

function titleOf(content: string, fallback: string): string {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) return fallback;
  for (const line of content.split("\n").slice(1)) {
    if (line.trimEnd() === "---") break;
    const match = /^title:\s*(.+)$/.exec(line);
    if (!match) continue;
    const value = (match[1] ?? "").trim();
    return value.replace(/^["']|["']$/g, "") || fallback;
  }
  return fallback;
}

function fileName(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

function displayName(path: string): string {
  return fileName(path).replace(/\.(md|ainote)$/i, "");
}

function syncStatus(store: MockStore) {
  return { ahead: 0, behind: 0, hasUncommitted: store.uncommitted, conflicted: store.conflicted };
}

function metaOf(path: string, note: { content: string; kind: string }) {
  return { path, kind: note.kind, title: titleOf(note.content, displayName(path)), updatedAt: Math.floor(Date.now() / 1000) };
}

interface E2eTreeNode {
  name: string;
  path: string;
  nodeType: "file" | "dir";
  children: E2eTreeNode[];
}

function treeOf(notes: Map<string, { content: string; kind: string }>): E2eTreeNode {
  const root: E2eTreeNode = { name: "", path: "", nodeType: "dir", children: [] };
  for (const path of notes.keys()) {
    const segments = path.split("/");
    let folder = root.children;
    segments.forEach((segment, index) => {
      const isFile = index === segments.length - 1;
      const existing = folder.find((item) => item.name === segment);
      if (existing) { folder = existing.children; return; }
      const node: E2eTreeNode = isFile
        ? { name: segment, path, nodeType: "file", children: [] }
        : { name: segment, path: segments.slice(0, index + 1).join("/"), nodeType: "dir", children: [] };
      folder.push(node);
      folder = node.children;
    });
  }
  return root;
}

/** 全仓提交历史：优先种子，缺省时由各文件版本聚合（每个版本视为一条提交）。 */
function repoHistoryOf(ctx: E2eCommandContext) {
  const seeded = ctx.state.repoHistory ?? [];
  if (seeded.length > 0) {
    return seeded.map((commit) => ({
      id: commit.id,
      shortId: commit.id.slice(0, 7),
      message: commit.message,
      author: "e2e",
      timestamp: Math.floor(Date.now() / 1000) - Number(commit.id),
      parents: [],
      files: commit.files,
    }));
  }
  const byId = new Map<string, { message: string; files: Array<{ path: string; status: "added" | "modified" | "deleted" }> }>();
  for (const [path, versions] of Object.entries(ctx.state.versions ?? {})) {
    for (const version of versions) {
      const entry = byId.get(version.id) ?? { message: version.message, files: [] };
      entry.files.push({ path, status: "modified" });
      byId.set(version.id, entry);
    }
  }
  return [...byId.entries()].map(([id, entry]) => ({
    id,
    shortId: id.slice(0, 7),
    message: entry.message,
    author: "e2e",
    timestamp: Math.floor(Date.now() / 1000) - Number(id),
    parents: [],
    files: entry.files,
  }));
}

function needNote(map: MockStore["notes"], path: string) {
  const note = map.get(path);
  if (!note) throw appError(`note not found: ${path}`);
  return note;
}

const commandHandlers: Record<string, CommandHandler> = {
  auth_status: (_args, ctx) => ({ hasToken: true, repoPath: ctx.state.repoPath }),
  sync_status: (_args, ctx) => syncStatus(ctx.store),
  sync_now: (args, ctx) => {
    if (ctx.state.syncFailure) return Promise.reject(ctx.state.syncFailure);
    const retry = ctx.state.syncRetry;
    if (!retry) return syncStatus(ctx.store);
    emitSyncProgress(args.onEvent, retry);
    return new Promise((resolve) => {
      ctx.store.pendingSync = resolve;
    });
  },
  cancel_sync_retry: (_args, ctx) => {
    const pending = ctx.store.pendingSync;
    ctx.store.pendingSync = null;
    pending?.(syncStatus(ctx.store));
    return null;
  },
  confirm_close: () => null,
  set_draft_dirty: () => null,
  git_pull: (_args, ctx) => syncStatus(ctx.store),
  git_push: (_args, ctx) => syncStatus(ctx.store),
  git_commit: () => "e2e-commit",
  git_status_files: (_args, ctx) => ctx.store.changedFiles,
  git_repo_history: (_args, ctx) => repoHistoryOf(ctx),
  list_notes: (_args, ctx) => [...ctx.store.notes.entries()].map(([path, note]) => metaOf(path, note)),
  read_note: (args, ctx) => {
    const path = String(args.path ?? "");
    const note = needNote(ctx.store.notes, path);
    return { path, kind: note.kind, content: note.content };
  },
  update_note: (args, ctx) => {
    const path = String(args.path ?? "");
    needNote(ctx.store.notes, path).content = String(args.content ?? "");
    return null;
  },
  create_note: (args, ctx) => {
    const path = String(args.path ?? "");
    const kind = String(args.kind ?? "markdown") as "markdown" | "richText";
    const content = String(args.content ?? "");
    ctx.store.notes.set(path, { content, kind });
    return metaOf(path, { content, kind });
  },
  note_tree: (_args, ctx) => treeOf(ctx.store.notes),
  wiki_index: (_args, ctx) => [...ctx.store.notes.entries()].map(([path, note]) => ({
    path, title: titleOf(note.content, displayName(path)), tags: [], links: [], linkContexts: [],
  })),
  search_notes: () => [],
  create_folder: () => null,
  asset_exists: (args, ctx) => {
    const paths = Array.isArray(args.paths) ? (args.paths as string[]) : [];
    const assets = ctx.state.assets ?? {};
    return paths.map((path) => Object.keys(assets).some((key) => path.endsWith(`/${key}`)));
  },
  list_conflicts: (_args, ctx) => (ctx.store.conflicted ? ctx.store.conflicts : []),
  export_conflicts: () => ({ path: "/tmp/ainote-conflicts.zip", bytes: 64, files: ["local/a.md", "remote/a.md"] }),
  resolve_conflict: (args, ctx) => {
    const useLocal = args.useLocal === true;
    for (const conflict of ctx.store.conflicts) {
      needNote(ctx.store.notes, conflict.path).content = useLocal ? conflict.local : conflict.remote;
    }
    ctx.store.conflicted = false;
    return syncStatus(ctx.store);
  },
  resolve_file_conflict: (args, ctx) => {
    const path = String(args.path ?? "");
    needNote(ctx.store.notes, path).content = String(args.content ?? "");
    ctx.store.conflicts = ctx.store.conflicts.filter((conflict) => conflict.path !== path);
    ctx.store.conflicted = ctx.store.conflicts.length > 0;
    return syncStatus(ctx.store);
  },
  git_file_history: (args, ctx) => {
    const file = String(args.file ?? "");
    const versions = ctx.state.versions?.[file] ?? [];
    return versions.map((version) => ({
      id: version.id,
      shortId: version.id.slice(0, 7),
      message: version.message,
      author: "e2e",
      timestamp: Math.floor(Date.now() / 1000) - Number(version.id),
    }));
  },
  git_file_diff: (args, ctx) => {
    const file = String(args.file ?? "");
    const commitId = String(args.commitId ?? "");
    const version = (ctx.state.versions?.[file] ?? []).find((item) => item.id === commitId);
    if (!version) return { path: file, commitId, lines: [] };
    const lines = version.content.split("\n").map((text) => ({ kind: "context", text }));
    lines.unshift({ kind: "added", text: `${file} @ ${commitId}` });
    return { path: file, commitId, lines };
  },
  git_restore_file: (args, ctx) => {
    const file = String(args.file ?? "");
    const commitId = String(args.commitId ?? "");
    const version = (ctx.state.versions?.[file] ?? []).find((item) => item.id === commitId);
    if (!version) throw appError(`commit not found: ${commitId}`);
    needNote(ctx.store.notes, file).content = version.content;
    return null;
  },
  "plugin:event|listen": () => 1,
  "plugin:app|version": (_args, ctx) => ctx.state.appVersion ?? "0.24.12",
  metrics_record: (args, ctx) => {
    const event = String(args.event ?? "");
    if (ctx.store.metricsEnabled) ctx.store.metricsCounts[event] = (ctx.store.metricsCounts[event] ?? 0) + 1;
    return null;
  },
  metrics_clear: (_args, ctx) => {
    ctx.store.metricsCounts = {};
    return null;
  },
  metrics_set_enabled: (args, ctx) => {
    ctx.store.metricsEnabled = args.enabled !== false;
    return null;
  },
  metrics_read: (_args, ctx) => ({
    enabled: ctx.store.metricsEnabled,
    platform: "android",
    appVersion: ctx.state.appVersion ?? "0.24.12",
    updatedAt: "",
    totals: METRIC_EVENT_NAMES.map((event) => ({ event, count: ctx.store.metricsCounts[event] ?? 0, firstSeen: null })),
    activeDays: ctx.store.activeDays,
    syncSuccessRate: ctx.store.syncSuccessRate,
  }),
  metrics_export: (args, ctx) => {
    if (ctx.state.metricsExportCanceled) return null;
    const format = String(args.format ?? "");
    if (format !== "json" && format !== "csv") throw appError(`unsupported format: ${format}`);
    return { path: `/tmp/ainote-metrics-0.24.12.${format}`, bytes: 1536 };
  },
  open_external: () => null,
  print_current_page: () => null,
  "plugin:event|register_listener": () => 1,
  "plugin:event|unlisten": () => null,
  "plugin:event|emit": () => null,
  "plugin:event|emit_to": () => null,
};

let session: E2eCommandContext | null = null;

function context(): E2eCommandContext {
  if (session) return session;
  const global = globalThis as unknown as { __E2E_STATE__?: E2eState };
  const state = global.__E2E_STATE__ ?? { repoPath: "/mock-repo", notes: [] };
  session = { state, store: createStore(state) };
  return session;
}

/** 处理一条 IPC 命令（未知命令抛出结构化错误）。 */
export function handleCommand(cmd: string, args: Record<string, unknown>): Promise<unknown> {
  const handler = commandHandlers[cmd] ?? (() => { throw appError(`unsupported mock command: ${cmd}`); });
  return Promise.resolve(handler(args, context()));
}
