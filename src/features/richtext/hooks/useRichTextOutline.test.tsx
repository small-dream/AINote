import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRichTextOutline } from "./useRichTextOutline";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };
const HEADING_DOC = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "标题一" }] },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "标题二" }] },
  ],
};

describe("useRichTextOutline", () => {
  it("content 变化时刷新大纲", () => {
    const { result, rerender } = renderHook(({ content }) => useRichTextOutline(content), {
      initialProps: { content: JSON.stringify(EMPTY_DOC) },
    });
    expect(result.current).toEqual([]);

    rerender({ content: JSON.stringify(HEADING_DOC) });

    expect(result.current).toMatchObject([
      { text: "标题一", level: 1 },
      { text: "标题二", level: 2 },
    ]);
  });

  it("非法内容回退为空大纲", () => {
    const { result } = renderHook(() => useRichTextOutline("not json"));
    expect(result.current).toEqual([]);
  });
});
