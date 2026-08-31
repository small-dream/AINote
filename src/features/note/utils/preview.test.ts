import { describe, expect, it } from "vitest";
import { slugifyHeading, textContent } from "./preview";

describe("preview utils", () => {
  it("生成稳定标题锚点并保留中英文字符", () => {
    expect(slugifyHeading("  Hello, 世界!  ")).toBe("hello-世界");
    expect(slugifyHeading("---")).toBe("section");
  });

  it("提取嵌套 children 的纯文本", () => {
    expect(textContent(["a", { props: { children: ["b", "c"] } }])).toBe("abc");
  });
});
