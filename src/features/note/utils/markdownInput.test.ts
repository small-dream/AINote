import { describe, expect, it } from "vitest";
import { getListContinuation } from "./markdownInput";

describe("getListContinuation", () => {
  it("续写无序列表和任务列表", () => {
    expect(getListContinuation("- 第一项").insert).toBe("\n- ");
    expect(getListContinuation("  * [x] 已完成").insert).toBe("\n  * [ ] ");
  });

  it("递增有序列表编号", () => {
    expect(getListContinuation("3. 第三项").insert).toBe("\n4. ");
    expect(getListContinuation("9) 第九项").insert).toBe("\n10. ");
  });

  it("空列表项回车退出列表", () => {
    expect(getListContinuation("- ")).toEqual({ insert: "\n", exitList: true });
    expect(getListContinuation("普通文本")).toEqual({ insert: null, exitList: false });
  });
});
