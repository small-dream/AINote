/** E2E mock：笔记读写与目录树（note_tree / wiki 索引）的内存实现，写入即登记待提交变更。 */
import { markWorkspaceDirty, type DirtyTrackedStore } from "./dirty";
import { isEnvelopeText, unwrapEnvelope, wrapEnvelope } from "./envelope";
import type { E2eVaultState } from "./types";

export type E2eNoteMap = Map<string, { content: string; kind: string }>;

/** 笔记命令依赖「笔记表 + 待提交记账 + 加密库状态机」，与 backend 的完整 mock store 解耦。 */
export interface NoteStore extends DirtyTrackedStore {
  notes: E2eNoteMap;
  vaultState: E2eVaultState;
}

interface NoteCommandContext {
  store: NoteStore;
}

type NoteCommandHandler = (args: Record<string, unknown>, ctx: NoteCommandContext) => unknown;

function noteError(message: string): { code: string; kind: string; message: string; retriable: boolean } {
  return { code: "NOTE_1001", kind: "Note", message, retriable: false };
}

export function needNote(map: E2eNoteMap, path: string) {
  const note = map.get(path);
  if (!note) throw noteError(`note not found: ${path}`);
  return note;
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

/** 加密态由内容信封首行派生（与 Rust `is_envelope_file` 同口径），信封内容标题回退为文件名。 */
export function metaOf(path: string, note: { content: string; kind: string }) {
  return { path, kind: note.kind, title: titleOf(note.content, displayName(path)), updatedAt: Math.floor(Date.now() / 1000), encrypted: isEnvelopeText(note.content) };
}

/** read_note 的加密语义（Rust note_service::read_note）：锁定态返回 locked + 空内容，解锁态返回解密明文。 */
function readNoteContent(path: string, note: { content: string; kind: string }, vaultState: E2eVaultState) {
  if (!isEnvelopeText(note.content)) return { path, kind: note.kind, content: note.content, locked: false, encrypted: false };
  if (vaultState !== "unlocked") return { path, kind: note.kind, content: "", locked: true, encrypted: true };
  return { path, kind: note.kind, content: unwrapEnvelope(note.content), locked: false, encrypted: true };
}

/** update_note 的信封语义（Rust note_content::write_text）：信封笔记继续以密文落盘，锁定态拒绝写入。 */
function writeNoteContent(store: NoteStore, note: { content: string; kind: string }, content: string): void {
  if (isEnvelopeText(note.content)) {
    if (store.vaultState !== "unlocked") {
      throw { code: "VAULT_9001", kind: "Permission", message: "加密笔记需要先解锁仓库密钥", retriable: false };
    }
    note.content = wrapEnvelope(content);
    return;
  }
  note.content = content;
}

interface E2eTreeNode {
  name: string;
  path: string;
  nodeType: "file" | "dir";
  encrypted: boolean;
  children: E2eTreeNode[];
}

function treeOf(notes: E2eNoteMap): E2eTreeNode {
  const root: E2eTreeNode = { name: "", path: "", nodeType: "dir", encrypted: false, children: [] };
  for (const path of notes.keys()) {
    const segments = path.split("/");
    let folder = root.children;
    segments.forEach((segment, index) => {
      const isFile = index === segments.length - 1;
      const existing = folder.find((item) => item.name === segment);
      if (existing) { folder = existing.children; return; }
      const node: E2eTreeNode = isFile
        ? { name: segment, path, nodeType: "file", encrypted: isEnvelopeText(notes.get(path)?.content ?? ""), children: [] }
        : { name: segment, path: segments.slice(0, index + 1).join("/"), nodeType: "dir", encrypted: false, children: [] };
      folder.push(node);
      folder = node.children;
    });
  }
  return root;
}

export const noteCommandHandlers: Record<string, NoteCommandHandler> = {
  list_notes: (_args, ctx) => [...ctx.store.notes.entries()].map(([path, note]) => metaOf(path, note)),
  read_note: (args, ctx) => {
    const path = String(args.path ?? "");
    return readNoteContent(path, needNote(ctx.store.notes, path), ctx.store.vaultState);
  },
  update_note: (args, ctx) => {
    const path = String(args.path ?? "");
    writeNoteContent(ctx.store, needNote(ctx.store.notes, path), String(args.content ?? ""));
    markWorkspaceDirty(ctx.store, path);
    return null;
  },
  create_note: (args, ctx) => {
    const path = String(args.path ?? "");
    const kind = String(args.kind ?? "markdown") as "markdown" | "richText";
    const content = String(args.content ?? "");
    ctx.store.notes.set(path, { content, kind });
    markWorkspaceDirty(ctx.store, path, "added");
    return metaOf(path, { content, kind });
  },
  note_tree: (_args, ctx) => treeOf(ctx.store.notes),
  wiki_index: (_args, ctx) => [...ctx.store.notes.entries()].map(([path, note]) => ({
    path, title: titleOf(note.content, displayName(path)), tags: [], links: [], linkContexts: [],
  })),
};
