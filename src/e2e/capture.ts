/** E2E mock：快速捕捉、快捷键设置与 Android 待确认分享。 */
import type { CaptureInput, CaptureSettings, SharedCapture } from "@/api/types";
import { markWorkspaceDirty, type DirtyTrackedStore } from "./dirty";
import { metaOf, type E2eNoteMap } from "./notes";
import type { E2eState } from "./types";

export interface CaptureStore extends DirtyTrackedStore {
  notes: E2eNoteMap;
  pendingShare: SharedCapture | null;
  captureSeq: number;
  captureShortcut: string;
}

interface CaptureContext {
  state: E2eState;
  store: CaptureStore;
}

type CaptureHandler = (args: Record<string, unknown>, ctx: CaptureContext) => unknown;

const DEFAULT_SHORTCUT = "CommandOrControl+Shift+Space";

function captureError(message: string, code = "CAPTURE_10001") {
  return { code, kind: "Conflict", message, retriable: false };
}

function inputOf(args: Record<string, unknown>): CaptureInput {
  const value = (args.input ?? {}) as Partial<CaptureInput>;
  return {
    text: String(value.text ?? ""),
    tags: Array.isArray(value.tags) ? value.tags.map(String) : [],
    link: value.link ? String(value.link) : null,
    shareIntakeId: value.shareIntakeId ? String(value.shareIntakeId) : null,
  };
}

function titleOf(input: CaptureInput): string {
  return input.text.split("\n").find((line) => line.trim())?.trim()
    || (input.link ? "链接捕捉" : "快速捕捉");
}

function slugOf(title: string): string {
  const slug = title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return slug || "capture";
}

function markdownOf(input: CaptureInput, title: string): string {
  const tags = [...new Set(input.tags.map((tag) => tag.trim().replace(/^#/, "").toLowerCase()).filter(Boolean))];
  const blocks = [input.text, input.link ?? "", tags.map((tag) => `#${tag}`).join(" ")]
    .filter((block) => block.trim().length > 0);
  return `---\ntitle: '${title.replace(/'/g, "''")}'\n---\n\n${blocks.join("\n\n")}\n`;
}

function settings(ctx: CaptureContext): CaptureSettings {
  return { shortcut: ctx.store.captureShortcut, defaultShortcut: DEFAULT_SHORTCUT, registered: true, error: null };
}

export const captureCommandHandlers: Record<string, CaptureHandler> = {
  capture_get_settings: (_args, ctx) => settings(ctx),
  capture_set_shortcut: (args, ctx) => {
    if (ctx.state.captureFailure) throw captureError(String(ctx.state.captureFailure.message ?? "快捷键注册失败"));
    ctx.store.captureShortcut = String(args.shortcut ?? DEFAULT_SHORTCUT);
    return settings(ctx);
  },
  capture_reset_shortcut: (_args, ctx) => {
    ctx.store.captureShortcut = DEFAULT_SHORTCUT;
    return settings(ctx);
  },
  capture_create: (args, ctx) => {
    if (ctx.state.captureFailure) throw captureError(String(ctx.state.captureFailure.message ?? "捕获保存失败"));
    const input = inputOf(args);
    const title = titleOf(input);
    ctx.store.captureSeq += 1;
    const path = `inbox/e2e-${ctx.store.captureSeq}-${slugOf(title)}.md`;
    ctx.store.notes.set(path, { content: markdownOf(input, title), kind: "markdown" });
    markWorkspaceDirty(ctx.store, path, "added");
    if (input.shareIntakeId && ctx.store.pendingShare?.id === input.shareIntakeId) ctx.store.pendingShare = null;
    return metaOf(path, { content: ctx.store.notes.get(path)?.content ?? "", kind: "markdown" });
  },
  capture_pending_share: (_args, ctx) => ctx.store.pendingShare,
  capture_ack_share: (args, ctx) => {
    if (ctx.store.pendingShare?.id === String(args.intakeId ?? "")) ctx.store.pendingShare = null;
    return null;
  },
};
