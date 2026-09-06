import { describe, expect, it } from "vitest";
import { extractReleaseNotes } from "./releaseNotes";

const releaseBody = `## 更新内容

- 修复更新进度显示
- 支持 **Markdown** 更新说明

## What's new

- Fixed update progress
- Markdown notes are now supported

## 安装与更新

- 请前往 Release 页面下载。
`;

describe("extractReleaseNotes", () => {
  it("双语 Release 中只显示当前语言内容", () => {
    expect(extractReleaseNotes(releaseBody, "zh-CN")).toContain("Markdown");
    expect(extractReleaseNotes(releaseBody, "zh-CN")).not.toContain("Fixed update progress");
  });

  it("按当前语言截取更新内容", () => {
    expect(extractReleaseNotes("## 更新内容\n\n- 修复更新\n\n## 安装与更新\n\n- 下载", "zh-CN"))
      .toBe("- 修复更新");
  });

  it("英文界面使用 What's new 内容", () => {
    expect(extractReleaseNotes("## 更新内容\n\n- 修复\n\n## What's new\n\n- Fixed release notes", "en-US"))
      .toBe("- Fixed release notes");
  });

  it("当前语言缺失时回退到另一语言的更新内容", () => {
    expect(extractReleaseNotes("## What's new\n\n- Fixed update notes", "zh-CN"))
      .toBe("- Fixed update notes");
  });

  it("没有分段标题时保留 Markdown 内容", () => {
    expect(extractReleaseNotes("- 修复更新\n- 支持渲染", "en-US"))
      .toBe("- 修复更新\n- 支持渲染");
  });
});
