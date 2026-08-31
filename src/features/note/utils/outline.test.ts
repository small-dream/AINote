import { describe, expect, it } from "vitest";
import { extractOutline } from "./outline";

describe("extractOutline", () => {
  it("提取标题层级、行号和稳定 id", () => {
    expect(extractOutline("# 首页\n\n## 设计\n### 细节")).toEqual([
      { id: "首页", text: "首页", level: 1, line: 1 },
      { id: "设计", text: "设计", level: 2, line: 3 },
      { id: "细节", text: "细节", level: 3, line: 4 },
    ]);
  });

  it("忽略代码围栏和 frontmatter 中的伪标题", () => {
    const content = "---\ntitle: Demo\n---\n# 正文\n```md\n## 代码标题\n```";
    expect(extractOutline(content).map((item) => item.text)).toEqual(["正文"]);
  });

  it("为重复标题生成可区分 id，并清理行内标记", () => {
    expect(extractOutline("# 相同\n# 相同\n# [链接](https://example.com)").map((item) => item.id)).toEqual(["相同", "相同-2", "链接"]);
  });
});
