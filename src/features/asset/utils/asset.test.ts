import { describe, expect, it } from "vitest";
import { basename, insertAssetImage, resolveLocalAssetPath } from "./asset";
import type { EditorState } from "@codemirror/state";

function fakeState(from: number, to: number, doc: string): EditorState {
  return { selection: { main: { from, to } }, sliceDoc: () => doc } as unknown as EditorState;
}

describe("basename", () => {
  it("取最后一段为文件名", () => {
    expect(basename("/Users/jake/photo.png")).toBe("photo.png");
  });

  it("兼容 Windows 反斜杠", () => {
    expect(basename("C:\\Users\\jake\\图.png")).toBe("图.png");
  });

  it("空路径回退自身", () => {
    expect(basename("")).toBe("");
  });
});

describe("insertAssetImage", () => {
  it("在光标处插入仓库相对路径引用并定位末尾", () => {
    const result = insertAssetImage(fakeState(5, 5, "abcde"), "assets/photo.png", "photo.png");
    expect(result.changes).toEqual({ from: 5, to: 5, insert: "![photo.png](assets/photo.png)" });
    expect(result.selection).toEqual({ anchor: 5 + "![photo.png](assets/photo.png)".length });
  });

  it("有选区时替换选区内容", () => {
    const result = insertAssetImage(fakeState(1, 4, "abcd"), "assets/a.png", "a.png");
    expect(result.changes).toEqual({ from: 1, to: 4, insert: "![a.png](assets/a.png)" });
  });
});

describe("resolveLocalAssetPath", () => {
  const repo = "/Users/jake/notes";

  it("仓库相对路径解析为本地绝对路径", () => {
    expect(resolveLocalAssetPath(repo, "assets/photo.png")).toBe("/Users/jake/notes/assets/photo.png");
  });

  it("外部 URL 返回 null", () => {
    expect(resolveLocalAssetPath(repo, "https://example.com/a.png")).toBeNull();
    expect(resolveLocalAssetPath(repo, "data:image/png;base64,x")).toBeNull();
  });

  it("空 src 返回 null", () => {
    expect(resolveLocalAssetPath(repo, "  ")).toBeNull();
  });

  it("没有仓库上下文时不把相对路径解析到根目录", () => {
    expect(resolveLocalAssetPath("", "assets/photo.png")).toBeNull();
  });

  it("规范化仓库内相对路径并拒绝越过仓库根目录", () => {
    expect(resolveLocalAssetPath(repo, "notes/../assets/photo.png")).toBe("/Users/jake/notes/assets/photo.png");
    expect(resolveLocalAssetPath(repo, "../../outside.png")).toBeNull();
  });

  it("绝对路径与 Windows 盘符原样返回", () => {
    expect(resolveLocalAssetPath(repo, "/tmp/x.png")).toBe("/tmp/x.png");
    expect(resolveLocalAssetPath(repo, "C:\\notes\\assets\\a.png")).toBe("C:\\notes\\assets\\a.png");
  });

  it("repoPath 末尾斜杠不影响拼接", () => {
    expect(resolveLocalAssetPath("/Users/jake/notes/", "assets/a.png")).toBe("/Users/jake/notes/assets/a.png");
  });
});
