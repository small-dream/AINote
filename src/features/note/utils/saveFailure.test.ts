import { describe, expect, it } from "vitest";
import { saveFailureHintKey } from "./saveFailure";

describe("saveFailureHintKey", () => {
  it("IO 错误指向磁盘与权限", () => {
    expect(saveFailureHintKey("IO_5001")).toBe("note.saveFailedHintIo");
  });

  it("其他错误给出重试与诊断包建议", () => {
    expect(saveFailureHintKey("NOTE_1001")).toBe("note.saveFailedHint");
    expect(saveFailureHintKey("GIT_4001")).toBe("note.saveFailedHint");
  });

  it("缺少错误码时仍给出建议", () => {
    expect(saveFailureHintKey(null)).toBe("note.saveFailedHint");
    expect(saveFailureHintKey(undefined)).toBe("note.saveFailedHint");
  });
});
