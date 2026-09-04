import { describe, expect, it } from "vitest";
import { toggleTaskAtLine } from "./task";

describe("toggleTaskAtLine", () => {
  it("只切换目标行并保留其他源码", () => {
    const source = "# title\r\n\r\n- [ ] first\r\n2. [x] second";
    expect(toggleTaskAtLine(source, 3, true)).toBe("# title\r\n\r\n- [x] first\r\n2. [x] second");
  });

  it("支持嵌套任务和大小写 X", () => {
    expect(toggleTaskAtLine("  * [X] done", 1, false)).toBe("  * [ ] done");
  });

  it("非任务行、无效行号或状态未变化时返回 null", () => {
    expect(toggleTaskAtLine("普通文本", 1, true)).toBeNull();
    expect(toggleTaskAtLine("- [ ] todo", 0, true)).toBeNull();
    expect(toggleTaskAtLine("- [x] todo", 1, true)).toBeNull();
  });
});
