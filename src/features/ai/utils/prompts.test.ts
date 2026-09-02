import { describe, expect, it } from "vitest";
import { actionSystem, buildChatSystem, buildWritePrompt, AI_WRITE_ACTIONS } from "./prompts";

describe("actionSystem", () => {
  it("每个动作都有对应系统提示", () => {
    for (const action of AI_WRITE_ACTIONS) {
      expect(actionSystem(action).length).toBeGreaterThan(10);
    }
  });

  it("润色提示要求保持原意", () => {
    expect(actionSystem("polish")).toContain("润色");
  });
});

describe("buildWritePrompt", () => {
  it("润色携带原文", () => {
    expect(buildWritePrompt("polish", "  正文  ")).toContain("正文");
  });

  it("续写携带标题上下文", () => {
    const prompt = buildWritePrompt("continue", "开头", "我的标题");
    expect(prompt).toContain("我的标题");
    expect(prompt).toContain("开头");
  });

  it("摘要使用整篇内容并请求覆盖要点", () => {
    const prompt = buildWritePrompt("summarize", "全文内容");
    expect(prompt).toContain("全文内容");
    expect(prompt).toContain("摘要");
  });

  it("翻译目标为简体中文", () => {
    expect(buildWritePrompt("translate", "hello")).toContain("简体中文");
  });
});

describe("buildChatSystem", () => {
  it("当前笔记范围包含笔记正文", () => {
    const system = buildChatSystem("current", "笔记内容");
    expect(system).toContain("笔记内容");
  });

  it("全库检索范围不内嵌正文", () => {
    const system = buildChatSystem("repo", "笔记内容");
    expect(system).not.toContain("笔记内容");
  });

  it("超长笔记被截断", () => {
    const huge = "a".repeat(10000);
    const system = buildChatSystem("current", huge);
    expect(system).toHaveLength(8000 + "你是 AINote 的笔记助手。以下是当前笔记全文，请优先依据笔记内容回答，并指出依据的段落：\n\n【当前笔记】\n".length);
  });
});
