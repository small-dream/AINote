import { fireEvent, render } from "@testing-library/react";
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

describe("MarkdownPreview 图片 Lightbox", () => {
  it("点击已加载图片打开大图并支持 Escape 关闭", () => {
    const { container } = render(<MarkdownPreview content={"![logo](https://example.com/a.png)"} />);
    const image = container.querySelector(".markdown-image img") as HTMLImageElement;
    fireEvent.load(image);
    fireEvent.click(container.querySelector(".markdown-image-trigger") as HTMLButtonElement);
    expect(document.querySelector(".markdown-image-lightbox")).toBeTruthy();
    expect(document.querySelector(".markdown-image-lightbox img")?.getAttribute("src")).toBe("https://example.com/a.png");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelector(".markdown-image-lightbox")).toBeNull();
  });

  it("图片加载失败时禁用放大入口", () => {
    const { container } = render(<MarkdownPreview content={"![logo](https://example.com/missing.png)"} />);
    const image = container.querySelector(".markdown-image img") as HTMLImageElement;
    fireEvent.error(image);
    expect(container.querySelector<HTMLButtonElement>(".markdown-image-trigger")?.disabled).toBe(true);
    expect(container.querySelector(".markdown-image-error")).toBeTruthy();
  });

  it("图片地址变化时重置加载状态", () => {
    const { container, rerender } = render(<MarkdownPreview content={"![logo](https://example.com/old.png)"} />);
    fireEvent.load(container.querySelector(".markdown-image img") as HTMLImageElement);
    rerender(<MarkdownPreview content={"![logo](https://example.com/new.png)"} />);
    expect(container.querySelector(".markdown-image")?.className).toContain("markdown-image-loading");
  });
});

describe("MarkdownPreview 双链渲染（P1-5）", () => {
  it("[[目标]] 渲染为可点击链接并回调目标名", () => {
    const onOpenWiki = vi.fn();
    const { container } = render(
      <MarkdownPreview content={"见 [[项目计划]] 继续"} onOpenWiki={onOpenWiki} />
    );
    const link = container.querySelector(".wiki-link");
    expect(link?.textContent).toBe("项目计划");
    fireEvent.click(link as HTMLElement);
    expect(onOpenWiki).toHaveBeenCalledWith("项目计划");
  });

  it("[[目标|别名]] 显示别名并回调原始目标", () => {
    const onOpenWiki = vi.fn();
    const { container } = render(
      <MarkdownPreview content={"[[plan|计划]]"} onOpenWiki={onOpenWiki} />
    );
    const link = container.querySelector(".wiki-link");
    expect(link?.textContent).toBe("计划");
    fireEvent.click(link as HTMLElement);
    expect(onOpenWiki).toHaveBeenCalledWith("plan");
  });

  it("普通链接不受影响", () => {
    const { container } = render(
      <MarkdownPreview content={"[外部](https://example.com)"} />
    );
    expect(container.querySelector(".wiki-link")).toBeNull();
  });

  it("根据索引标记未解析双链并提供状态提示", () => {
    const { container } = render(
      <MarkdownPreview content={"[[已存在]] [[待创建]]"} wikiNotes={[{ path: "exists.md", title: "已存在", tags: [], links: [] }]} />
    );
    expect(container.querySelector(".wiki-link:not(.wiki-link-unresolved)")?.textContent).toBe("已存在");
    const unresolved = container.querySelector(".wiki-link-unresolved");
    expect(unresolved?.textContent).toBe("待创建");
    expect(unresolved?.getAttribute("title")).toBe("未创建");
  });
});

describe("MarkdownPreview P1 预览增强", () => {
  it("标题生成可跳转锚点", () => {
    const { container } = render(<MarkdownPreview content={"# Hello, 世界!"} />);
    expect(container.querySelector("h1")?.id).toBe("hello-世界");
  });

  it("内容更新后重新生成标题锚点", () => {
    const { container, rerender } = render(<MarkdownPreview content={"# 旧标题"} />);
    rerender(<MarkdownPreview content={"# 新标题"} />);

    expect(container.querySelector("h1")?.id).toBe("新标题");
  });

  it("代码块显示语言和复制操作", () => {
    const { container } = render(<MarkdownPreview content={"```ts\nconst answer = 42;\n```"} />);
    expect(container.querySelector(".markdown-code-toolbar")?.textContent).toContain("ts");
    expect(container.querySelector("pre code")?.className).toContain("language-ts");
    expect(container.querySelector(".markdown-code-toolbar button")).toBeTruthy();
  });

  it("外部链接使用新窗口安全属性", () => {
    const { container } = render(<MarkdownPreview content={"[文档](https://example.com)"} />);
    const link = container.querySelector("a:not(.wiki-link)");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noreferrer");
  });

  it("表格包裹横向滚动容器", () => {
    const { container } = render(<MarkdownPreview content={"| A | B |\n| - | - |\n| 1 | 2 |"} />);
    expect(container.querySelector(".markdown-table-wrap table")).toBeTruthy();
  });

  it("Preview 任务勾选回写 Markdown 源码", () => {
    const onChange = vi.fn();
    const { container } = render(<MarkdownPreview content={"- [ ] 待办"} onChange={onChange} />);
    const checkbox = container.querySelector<HTMLInputElement>("input[type='checkbox']");
    expect(checkbox?.disabled).toBe(false);
    fireEvent.click(checkbox as HTMLInputElement);
    expect(onChange).toHaveBeenCalledWith("- [x] 待办");
  });
});

describe("MarkdownPreview properties and callouts", () => {
  it("单换行渲染为 <br>（remark-breaks 保换行）", () => {
    const { container } = render(<MarkdownPreview content={"第一行\n第二行"} />);
    const p = container.querySelector("p");
    expect(p?.querySelector("br")).toBeTruthy();
    expect(p?.textContent).toContain("第一行");
    expect(p?.textContent).toContain("第二行");
  });

  it("展示 frontmatter 属性且不把分隔线渲染到正文", () => {
    const { container } = render(<MarkdownPreview content={"---\ntitle: Demo\ntags: [one, two]\n---\n正文"} />);
    expect(container.querySelector(".markdown-properties")?.textContent).toContain("title");
    expect(container.querySelector(".markdown-properties")?.textContent).toContain("one, two");
    expect(container.querySelectorAll("hr")).toHaveLength(0);
    expect(container.textContent).toContain("正文");
  });

  it("渲染 note/tip/warning/danger callout", () => {
    const { container } = render(<MarkdownPreview content={"> [!TIP] 小提示\n> 内容"} />);
    const callout = container.querySelector("[data-callout='tip']");
    expect(callout?.className).toContain("markdown-callout-tip");
    expect(callout?.textContent).toContain("小提示");
    expect(callout?.textContent).not.toContain("[!TIP]");
  });

  it("渲染行内与块级数学公式", () => {
    const { container } = render(<MarkdownPreview content={"行内 $x^2$\n\n$$\n\\frac{1}{2}\n$$"} />);
    expect(container.querySelector(".katex")).toBeTruthy();
    expect(container.querySelector(".katex-display")).toBeTruthy();
  });

  it("识别 Mermaid 代码块", () => {
    const { container } = render(<MarkdownPreview content={"```mermaid\ngraph TD\n A-->B\n```"} />);
    expect(container.querySelector(".markdown-mermaid")).toBeTruthy();
  });
});

describe("MarkdownPreview edge cases", () => {
  it("渲染 important/caution callout 时不保留语法前缀", () => {
    const { container } = render(<MarkdownPreview content={"> [!IMPORTANT] 重要\n\n> [!CAUTION] 注意"} />);
    expect(container.textContent).not.toContain("[!IMPORTANT]");
    expect(container.textContent).not.toContain("[!CAUTION]");
  });

  it("没有仓库路径时保留相对图片 URL", () => {
    const { container } = render(<MarkdownPreview content={"![图](assets/photo.png)"} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("assets/photo.png");
    expect(assetUrlMock).not.toHaveBeenCalled();
  });
});
