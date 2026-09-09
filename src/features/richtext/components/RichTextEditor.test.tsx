import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { RichTextEditor } from "./RichTextEditor";

const EMPTY = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });
const HEADING = JSON.stringify({
  type: "doc",
  content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "标题一" }] }],
});

function wrap(node: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>;
}

function renderEditor(content: string) {
  return render(wrap(<RichTextEditor content={content} onChange={() => undefined} repoPath={null} notePath="a.ainote" />));
}

function outlineText(container: HTMLElement): string {
  return container.querySelector(".markdown-outline-panel")?.textContent ?? "";
}

describe("RichTextEditor 大纲", () => {
  it("外部 content 更新后刷新大纲（首次加载 / 标题同步场景）", () => {
    const { container, rerender } = renderEditor(EMPTY);
    expect(outlineText(container)).not.toContain("标题一");

    rerender(wrap(<RichTextEditor content={HEADING} onChange={() => undefined} repoPath={null} notePath="a.ainote" />));

    expect(outlineText(container)).toContain("标题一");
  });
});
