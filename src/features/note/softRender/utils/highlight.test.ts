import { describe, expect, it } from "vitest";
import { highlightCode } from "./highlight";

async function settleHighlight(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("highlightCode", () => {
  it("无语言且自动识别失败时保留源码", async () => {
    const pre = highlightCode("| dedup devid", null);
    const code = pre.querySelector("code");

    expect(code?.textContent).toBe("| dedup devid");
    await settleHighlight();
    expect(code?.textContent).toBe("| dedup devid");
  });
});
