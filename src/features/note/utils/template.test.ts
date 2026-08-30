import { describe, expect, it } from "vitest";
import {
  defaultNoteFileName,
  formatDate,
  renderNoteTemplate,
} from "./template";

const NOW = new Date(2026, 7, 30);

describe("formatDate", () => {
  it("格式化为 YYYY-MM-DD（补零）", () => {
    expect(formatDate(NOW)).toBe("2026-08-30");
  });
});

describe("defaultNoteFileName", () => {
  it("daily 用日期文件名", () => {
    expect(defaultNoteFileName("daily", NOW)).toBe("2026-08-30.md");
  });

  it("default/blank 用未命名", () => {
    expect(defaultNoteFileName("default", NOW)).toBe("未命名.md");
    expect(defaultNoteFileName("blank", NOW)).toBe("未命名.md");
  });
});

describe("renderNoteTemplate", () => {
  it("daily 渲染日期标题", () => {
    expect(renderNoteTemplate("daily", NOW)).toBe("# 2026-08-30\n\n");
  });

  it("blank 渲染空内容", () => {
    expect(renderNoteTemplate("blank", NOW)).toBe("");
  });

  it("default 返回 null（后端默认模板）", () => {
    expect(renderNoteTemplate("default", NOW)).toBeNull();
  });
});
