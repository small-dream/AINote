import { describe, expect, it } from "vitest";
import { extractUpdaterNotes } from "./updater-notes.mjs";

const RELEASE_BODY = [
  "## 更新内容",
  "",
  "- **桌面端更新提示**：没有更新说明时给出占位文案。",
  "  - 影响范围：桌面端。",
  "",
  "## 安装与更新",
  "",
  "- Windows：下载 `.msi` 或 `.exe` 安装包。",
].join("\n");

describe("extractUpdaterNotes", () => {
  it("只取「更新内容」段落，不携带安装说明", () => {
    expect(extractUpdaterNotes(RELEASE_BODY)).toBe(
      ["- **桌面端更新提示**：没有更新说明时给出占位文案。", "  - 影响范围：桌面端。"].join("\n"),
    );
  });

  it("保留段落内的三级标题，不当作分段截断", () => {
    const body = ["## 更新内容", "", "### 修复", "", "- 修好了", "", "## 安装与更新", "", "- 下载"].join("\n");
    expect(extractUpdaterNotes(body)).toBe(["### 修复", "", "- 修好了"].join("\n"));
  });

  it("兼容 CRLF 正文", () => {
    const body = ["## 更新内容", "- 修复 A", "", "## 安装与更新", "- 下载"].join("\r\n");
    expect(extractUpdaterNotes(body)).toBe("- 修复 A");
  });

  it("忽略文件开头的 BOM", () => {
    const body = "\uFEFF" + ["## 更新内容", "- 修复 A", "", "## 安装与更新", "- 下载"].join("\r\n");
    expect(extractUpdaterNotes(body)).toBe("- 修复 A");
  });

  it("没有「更新内容」段落时回退整篇正文", () => {
    expect(extractUpdaterNotes("- 修复 A\n- 修复 B")).toBe("- 修复 A\n- 修复 B");
  });

  it("段落为空时回退整篇正文", () => {
    expect(extractUpdaterNotes("## 更新内容\n\n## 安装与更新\n\n- 下载")).toBe(
      "## 更新内容\n\n## 安装与更新\n\n- 下载",
    );
  });

  it("空正文或非字符串返回空串", () => {
    expect(extractUpdaterNotes("")).toBe("");
    expect(extractUpdaterNotes("   \n\n")).toBe("");
    expect(extractUpdaterNotes(null)).toBe("");
    expect(extractUpdaterNotes(undefined)).toBe("");
  });
});
