import { describe, expect, it } from "vitest";
import { formatBytes, formatCheckedAt, formatUpdateDate } from "./updateFormat";

describe("updateFormat 更新信息格式化", () => {
  it("按可读单位显示下载字节数", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2.0 GB");
  });

  it("发布日期无效时返回 null", () => {
    expect(formatUpdateDate("not-a-date")).toBeNull();
  });

  it("检查时间为空时返回 null", () => {
    expect(formatCheckedAt(null)).toBeNull();
  });
});
