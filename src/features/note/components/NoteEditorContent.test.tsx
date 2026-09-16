import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NoteEditorContent, type NoteEditorContentProps } from "./NoteEditorSupport";
import type { MarkdownEditorSurfaceProps } from "./MarkdownEditorSurface";
import { useUiStore } from "@/stores/ui.store";

vi.mock("./EditorToolbar", () => ({ EditorToolbar: () => <div data-testid="toolbar" /> }));
vi.mock("./MarkdownEditorSurface", () => ({ MarkdownEditorSurface: () => <div data-testid="surface" /> }));
vi.mock("./PreviewContextMenu", () => ({ PreviewContextMenu: () => null }));
vi.mock("@/features/richtext/components/ConvertNoteDialog", () => ({ ConvertNoteDialog: () => null }));
vi.mock("@/features/wiki/components/WikiPanel", () => ({ WikiPanel: () => null }));
vi.mock("@/features/ai/components/AiWriteControls", () => ({ AiWriteControls: () => <div data-testid="ai-write-controls" /> }));
vi.mock("@/features/ai/components/AskAiPanel", () => ({
  AskAiPanel: ({ open }: { open: boolean }) => (open ? <div data-testid="ask-ai-panel" /> : null),
}));
vi.mock("@/features/vault/hooks/useNoteEncryption", () => ({
  useNoteEncryption: () => ({ available: false, action: "encrypt" as const, pending: false, toggle: () => undefined }),
}));

function createSurfaceProps(): MarkdownEditorSurfaceProps {
  return {
    mode: "edit", noteTheme: "classic", repoPath: "/repo", draft: "hello",
    onChange: vi.fn(), extensions: [], onCreateEditor: vi.fn(),
    previewRef: { current: null }, onOpenWiki: vi.fn(), wikiNotes: [],
    ratio: 0.5, onRatioChange: vi.fn(), outline: [], outlineOpen: false,
    onOutlineToggle: vi.fn(), onOutlineSelect: vi.fn(), diagnostics: [],
    diagnosticsOpen: false, onDiagnosticsToggle: vi.fn(), onDiagnosticsSelect: vi.fn(),
    viewRef: { current: null }, activeFormats: new Set<string>(), onImagePicked: vi.fn(),
    assetStatus: null, onContextMenu: vi.fn(),
  };
}

function createProps(overrides: Partial<NoteEditorContentProps> = {}): NoteEditorContentProps {
  return {
    notePath: "notes/a.md",
    repoPath: "/repo",
    kind: "markdown",
    draft: "hello",
    onChange: vi.fn(),
    onMove: vi.fn(),
    onOpenNote: vi.fn(),
    mode: "edit",
    compact: false,
    setMode: vi.fn(),
    setOutlineOpen: vi.fn(),
    outlineOpen: false,
    surfaceProps: createSurfaceProps(),
    previewMenu: { position: null, hasSelection: false, handleContextMenu: vi.fn(), openAt: vi.fn(), close: vi.fn(), copySelection: vi.fn(), copyLink: vi.fn(), openLink: vi.fn(), selectAll: vi.fn() },
    noteTheme: "classic",
    richTextDialog: { open: false, losses: [], converting: false },
    onRequestConvertToRichText: vi.fn(),
    onConfirmConvertToRichText: vi.fn(),
    onCancelConvertToRichText: vi.fn(),
    onConvertToMarkdown: vi.fn(),
    flush: async () => undefined,
    saving: false,
    dirty: false,
    saveError: null,
    saveErrorCode: null,
    history: { open: false, openHistory: vi.fn(), closeHistory: vi.fn(), reloadEpoch: 0, onRestored: vi.fn() },
    wiki: { notes: [], open: false, openPanel: vi.fn(), closePanel: vi.fn(), handleOpenWiki: vi.fn() },
    ai: {
      menuOpen: false, open: false, loading: false, preview: null, error: null,
      hasSelection: false, applyDocument: false,
      openMenu: vi.fn(), closeMenu: vi.fn(), run: async () => undefined,
      retry: vi.fn(), confirm: vi.fn(), cancel: vi.fn(),
    },
    suggest: {
      kind: null, loading: false, text: "", error: null, titles: [],
      startTitle: vi.fn(), startOutline: vi.fn(), pickTitle: vi.fn(), insertOutline: vi.fn(), close: vi.fn(),
    },
    askAiOpen: false,
    closeAskAi: () => useUiStore.getState().closeAskAi(),
    insertAnswer: vi.fn(),
    pdf: { open: false, title: "a", kind: "markdown", repoPath: "/repo", request: async () => undefined, close: vi.fn() },
    encrypted: false,
    ...overrides,
  };
}

describe("NoteEditorContent / 加密笔记 AI 隔离（决策③）", () => {
  afterEach(() => {
    useUiStore.setState({ askAiOpen: false });
  });

  it("明文笔记：渲染 AI 写作控件，问答面板随 askAiOpen 打开", async () => {
    render(<NoteEditorContent {...createProps({ askAiOpen: true })} />);
    expect(screen.getByTestId("ai-write-controls")).toBeTruthy();
    expect(await screen.findByTestId("ask-ai-panel")).toBeTruthy();
  });

  it("加密笔记：从一开始就不渲染 AI 写作控件与问答面板", () => {
    render(<NoteEditorContent {...createProps({ encrypted: true, askAiOpen: true })} />);
    expect(screen.queryByTestId("ai-write-controls")).toBeNull();
    expect(screen.queryByTestId("ask-ai-panel")).toBeNull();
  });

  it("切换到加密笔记：卸载 AI 入口并静默关闭残留的全局问答面板", async () => {
    useUiStore.getState().openAskAi();
    const { rerender } = render(<NoteEditorContent {...createProps({ askAiOpen: true })} />);
    expect(await screen.findByTestId("ask-ai-panel")).toBeTruthy();
    rerender(<NoteEditorContent {...createProps({ askAiOpen: true, encrypted: true })} />);
    expect(screen.queryByTestId("ask-ai-panel")).toBeNull();
    expect(screen.queryByTestId("ai-write-controls")).toBeNull();
    expect(useUiStore.getState().askAiOpen).toBe(false);
  });
});
