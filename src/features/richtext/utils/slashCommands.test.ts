import { describe, expect, it } from "vitest";
import { filterSlashCommands, SLASH_COMMANDS } from "./slashCommands";

describe("filterSlashCommands", () => {
  it("空查询返回全部命令", () => {
    expect(filterSlashCommands("")).toEqual(SLASH_COMMANDS);
    expect(filterSlashCommands("   ")).toEqual(SLASH_COMMANDS);
  });

  it("按关键字过滤命令", () => {
    expect(filterSlashCommands("head").map((c) => c.key)).toEqual(["h1", "h2", "h3"]);
    expect(filterSlashCommands("table").map((c) => c.key)).toEqual(["table"]);
  });

  it("支持中文关键字", () => {
    expect(filterSlashCommands("任务").map((c) => c.key)).toEqual(["taskList"]);
    expect(filterSlashCommands("标题").map((c) => c.key)).toEqual(["h1", "h2", "h3"]);
  });

  it("大小写不敏感", () => {
    expect(filterSlashCommands("LIST").map((c) => c.key)).toContain("bulletList");
    expect(filterSlashCommands("Table").map((c) => c.key)).toEqual(["table"]);
  });

  it("无匹配时返回空数组", () => {
    expect(filterSlashCommands("不存在的命令xyz")).toEqual([]);
  });
});
