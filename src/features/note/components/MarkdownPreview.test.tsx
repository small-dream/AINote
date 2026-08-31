import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownPreview } from "./MarkdownPreview";

const assetUrlMock = vi.hoisted(() => vi.fn((path: string) => `asset://${path}`));

beforeEach(() => {
  assetUrlMock.mockClear();
});

vi.mock("@/api", () => ({ assetUrl: assetUrlMock }));

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

describe("MarkdownPreview 本地资产图片渲染（P1-4）", () => {
  it("仓库相对路径转换为本地资产 URL", () => {
    const { container } = render(
      <MarkdownPreview content={"![图](assets/photo.png)"} repoPath="/repo" />
    );
    const img = container.querySelector("img");
    expect(assetUrlMock).toHaveBeenCalledWith("/repo/assets/photo.png");
    expect(img?.getAttribute("src")).toBe("asset:///repo/assets/photo.png");
  });

  it("外部 URL 图片保持原样", () => {
    const { container } = render(
      <MarkdownPreview content={"![logo](https://example.com/a.png)"} repoPath="/repo" />
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://example.com/a.png");
    expect(assetUrlMock).not.toHaveBeenCalled();
  });
});
