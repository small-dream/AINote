import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRichTextEditor } from "./useRichTextEditor";

const editorState = vi.hoisted(() => ({
  json: { type: "doc", content: [{ type: "paragraph" }] },
  setContent: vi.fn(),
}));

vi.mock("@tiptap/react", () => ({
  useEditor: vi.fn(() => ({
    getJSON: () => editorState.json,
    commands: { setContent: editorState.setContent },
    storage: { markdown: { getMarkdown: () => "" } },
  })),
}));

vi.mock("./useRichTextAssets", () => ({
  useRichTextAssets: vi.fn(() => ({
    handleFiles: vi.fn(),
    status: null,
    showStatus: vi.fn(),
  })),
}));

describe("useRichTextEditor content 同步", () => {
  beforeEach(() => {
    editorState.json = { type: "doc", content: [{ type: "paragraph" }] };
    editorState.setContent.mockReset();
  });

  it("异步加载内容后更新编辑器且不触发 onChange", () => {
    const onChange = vi.fn();
    const loaded = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "已保存" }] }] });
    const { rerender } = renderHook(({ content }) => useRichTextEditor({ content, onChange, repoPath: "/repo" }), { initialProps: { content: "" } });

    rerender({ content: loaded });

    expect(editorState.setContent).toHaveBeenCalledWith(JSON.parse(loaded), { emitUpdate: false });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("内容未变化时不重复重置编辑器", () => {
    const content = JSON.stringify(editorState.json);
    renderHook(() => useRichTextEditor({ content, onChange: vi.fn(), repoPath: null }));

    expect(editorState.setContent).not.toHaveBeenCalled();
  });
});
