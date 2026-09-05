import { describe, expect, it } from "vitest";
import {
  defaultNoteFileName,
  formatDate,
  renderNoteTemplate,
  uniqueDateNotePath,
  uniqueUntitledNotePath,
} from "./template";

const NOW = new Date(2026, 7, 30);

describe("formatDate", () => {
  it("格式化为 YYYY-MM-DD（补零）", () => {
    expect(formatDate(NOW)).toBe("2026-08-30");
  });
});

describe("defaultNoteFileName", () => {
  it("daily 用日期文件名", () => {
    expect(defaultNoteFileName("markdown", "daily", NOW)).toBe("2026-08-30.md");
    expect(defaultNoteFileName("richText", "daily", NOW)).toBe("2026-08-30.ainote");
  });

  it("default/blank 用未命名", () => {
    expect(defaultNoteFileName("markdown", "default", NOW)).toBe("未命名.md");
    expect(defaultNoteFileName("richText", "blank", NOW)).toBe("未命名.ainote");
  });
});

describe("renderNoteTemplate", () => {
  it("markdown daily 渲染日期标题", () => {
    expect(renderNoteTemplate("markdown", "daily", NOW)).toBe("# 2026-08-30\n\n");
  });

  it("markdown blank 渲染空内容", () => {
    expect(renderNoteTemplate("markdown", "blank", NOW)).toBe("");
  });

  it("markdown default 返回 null（后端默认模板）", () => {
    expect(renderNoteTemplate("markdown", "default", NOW)).toBeNull();
  });

  it("富文本渲染合法 JSON 文档", () => {
    const doc = renderNoteTemplate("richText", "default", NOW);
    expect(JSON.parse(doc as string).type).toBe("doc");
    expect(JSON.parse(doc as string).content[0].type).toBe("heading");
    const blank = renderNoteTemplate("richText", "blank", NOW);
    expect(JSON.parse(blank as string).content).toHaveLength(1);
  });
});

describe("uniqueDateNotePath", () => {
  it("按本地日期生成路径并为重复名称追加序号", () => {
    const existing = new Set(["daily/2026-08-30.md", "daily/2026-08-30-2.md"]);
    expect(uniqueDateNotePath("daily", "markdown", existing, NOW)).toBe("daily/2026-08-30-3.md");
    expect(uniqueDateNotePath("", "richText", new Set(), NOW)).toBe("2026-08-30.ainote");
  });
});

describe("uniqueUntitledNotePath", () => {
  it("使用未命名路径并跳过已存在名称", () => {
    const existing = new Set(["daily/未命名.md", "daily/未命名-2.md"]);
    expect(uniqueUntitledNotePath("daily", "markdown", existing)).toBe("daily/未命名-3.md");
    expect(uniqueUntitledNotePath("", "richText", new Set())).toBe("未命名.ainote");
  });
});
