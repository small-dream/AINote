import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownPreview } from "./MarkdownPreview";

describe("MarkdownPreview data-line", () => {
  it("为块级元素注入 data-line（Markdown 起始行号）", () => {
    const content = "# 标题\n\n第一段\n\n- 列表项\n\n> 引用\n";
    const { container } = render(<MarkdownPreview content={content} />);

    const h1 = container.querySelector("h1");
    expect(h1?.getAttribute("data-line")).toBe("1");

    const p = container.querySelector("p");
    expect(p?.getAttribute("data-line")).toBe("3");

    const li = container.querySelector("li");
    expect(li?.getAttribute("data-line")).toBe("5");

    const blockquote = container.querySelector("blockquote");
    expect(blockquote?.getAttribute("data-line")).toBe("7");
  });
});
