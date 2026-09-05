import { describe, expect, it } from "vitest";
import { formatRepoSize } from "./repoSize";

describe("formatRepoSize", () => {
  it("按可读单位格式化仓库大小", () => {
    expect(formatRepoSize(0)).toBe("0 B");
    expect(formatRepoSize(1023)).toBe("1023 B");
    expect(formatRepoSize(1024)).toBe("1.0 KB");
    expect(formatRepoSize(1536)).toBe("1.5 KB");
    expect(formatRepoSize(1024 * 1024 * 2.5)).toBe("2.5 MB");
  });

  it("无效值返回占位符", () => {
    expect(formatRepoSize(Number.NaN)).toBe("—");
    expect(formatRepoSize(-1)).toBe("—");
  });
});
