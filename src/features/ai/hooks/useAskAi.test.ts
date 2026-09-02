import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAskAi } from "./useAskAi";

const aiApiMock = vi.hoisted(() => ({
  chatStream: vi.fn(),
}));

vi.mock("@/api", () => ({
  aiApi: aiApiMock,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

function mockStream(text: string) {
  aiApiMock.chatStream.mockImplementation(
    async (_messages: unknown, _repoQuery: string | null, onChunk: (delta: string) => void) => {
      onChunk(text);
      return text;
    },
  );
}

function setup() {
  const { result } = renderHook(() => useAskAi({ noteContent: "当前笔记正文" }));
  return { result };
}

describe("useAskAi 对话与上下文", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStream("这是回答");
  });

  it("发送问题追加用户消息与 AI 回答", async () => {
    const { result } = setup();
    act(() => result.current.setInput("今天做了什么？"));
    act(() => {
      void result.current.send();
    });
    await waitFor(() => expect(result.current.history.length).toBe(2));
    expect(result.current.history[0]).toEqual({ role: "user", content: "今天做了什么？" });
    expect(result.current.history[1]).toEqual({ role: "assistant", content: "这是回答" });
    expect(result.current.input).toBe("");
  });

  it("当前笔记范围不发送全库检索", async () => {
    const { result } = setup();
    act(() => result.current.setInput("问题"));
    act(() => {
      void result.current.send();
    });
    await waitFor(() => expect(result.current.history.length).toBe(2));
    const args = aiApiMock.chatStream.mock.calls[0] ?? [];
    const [messages, repoQuery] = args as [{ role: string; content: string }[], string | null];
    expect(messages[0]?.role).toBe("system");
    expect(messages[0]?.content).toContain("当前笔记正文");
    expect(repoQuery).toBeNull();
  });
});

describe("useAskAi 全库与错误", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStream("这是回答");
  });

  it("全库检索范围发送检索词", async () => {
    const { result } = setup();
    act(() => result.current.setScope("repo"));
    act(() => result.current.setInput("找笔记"));
    act(() => {
      void result.current.send();
    });
    await waitFor(() => expect(result.current.history.length).toBe(2));
    const args = aiApiMock.chatStream.mock.calls[0] ?? [];
    const [, repoQuery] = args as [{ role: string; content: string }[], string | null];
    expect(repoQuery).toBe("找笔记");
  });

  it("失败记录错误并可清空", async () => {
    aiApiMock.chatStream.mockRejectedValueOnce(new Error("失败"));
    const { result } = setup();
    act(() => result.current.setInput("问题"));
    act(() => {
      void result.current.send();
    });
    await waitFor(() => expect(result.current.error).toBe("失败"));
    act(() => result.current.reset());
    expect(result.current.history).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
