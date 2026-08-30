import { act, render } from "@testing-library/react";
import { useCallback, useRef, useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import CodeMirror from "@uiw/react-codemirror";
import type { EditorView } from "@codemirror/view";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { useEditorViewReady } from "./useEditorViewReady";
import { useSyncScroll } from "./useSyncScroll";

const CONTENT = "# 标题\n\n第一段\n\n第二段\n\n第三段\n\n第四段\n\n第五段\n\n第六段";

let capturedView: EditorView | null = null;

/** 贴近 NoteEditor 的真实用法：edit → split 切换会让 CodeMirror 重挂载 */
function Harness() {
  const [mode, setMode] = useState<"edit" | "split">("edit");
  const previewRef = useRef<HTMLDivElement | null>(null);
  const { readyView, handleCreateEditor } = useEditorViewReady(
    useCallback((view: EditorView) => {
      capturedView = view;
    }, [])
  );
  useSyncScroll(readyView, previewRef, mode);

  const editor = <CodeMirror value={CONTENT} onCreateEditor={handleCreateEditor} />;
  return (
    <div>
      <button type="button" onClick={() => setMode("split")}>
        分栏
      </button>
      {mode === "split" ? (
        <div style={{ display: "flex", height: "400px" }}>
          <div style={{ width: "50%" }}>{editor}</div>
          <div ref={previewRef} data-preview="" style={{ overflowY: "auto", height: "400px" }}>
            <MarkdownPreview content={CONTENT} />
          </div>
        </div>
      ) : (
        <div>{editor}</div>
      )}
    </div>
  );
}

/** jsdom 不计算布局，给锚点元素注入递增位置 */
function mockLayout(preview: HTMLDivElement) {
  Array.from(preview.querySelectorAll("[data-line]")).forEach((el, i) => {
    Object.defineProperty(el, "getBoundingClientRect", { value: () => ({ top: i * 50 }) });
  });
  Object.defineProperty(preview, "getBoundingClientRect", { value: () => ({ top: 0 }) });
}

async function refreshAnchors(preview: HTMLDivElement) {
  // 布局 mock 生效后，触发 MutationObserver 让内部锚点表刷新
  const probe = document.createElement("span");
  preview.appendChild(probe);
  preview.removeChild(probe);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  capturedView = null;
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
});

describe("useSyncScroll 集成", () => {
  it("edit 切换到 split（CodeMirror 重挂载）后，滚动编辑器驱动预览", async () => {
    const { container, getByText } = render(<Harness />);
    await act(async () => {
      getByText("分栏").click();
    });
    const preview = container.querySelector<HTMLDivElement>("[data-preview]");
    if (!preview || !capturedView) throw new Error("elements not ready");

    await mockLayoutAndRefresh(preview);
    const view = capturedView;
    act(() => {
      view.scrollDOM.scrollTop = 60;
      view.scrollDOM.dispatchEvent(new Event("scroll"));
    });
    expect(preview.scrollTop).not.toBe(0);
  });

  it("edit 切换到 split 后，滚动预览反向驱动编辑器", async () => {
    const { container, getByText } = render(<Harness />);
    await act(async () => {
      getByText("分栏").click();
    });
    const preview = container.querySelector<HTMLDivElement>("[data-preview]");
    if (!preview || !capturedView) throw new Error("elements not ready");

    await mockLayoutAndRefresh(preview);
    const view = capturedView;
    act(() => {
      preview.scrollTop = 120;
      preview.dispatchEvent(new Event("scroll"));
    });
    expect(view.scrollDOM.scrollTop).not.toBe(0);
  });
});

async function mockLayoutAndRefresh(preview: HTMLDivElement) {
  mockLayout(preview);
  await refreshAnchors(preview);
}
