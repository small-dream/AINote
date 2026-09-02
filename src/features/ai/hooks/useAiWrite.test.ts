import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiWrite } from "./useAiWrite";
import { AI_SUMMARIZE, type AiWriteAction } from "../utils/prompts";

const aiApiMock = vi.hoisted(() => ({
  generateStream: vi.fn(),
}));

vi.mock("@/api", () => ({
  aiApi: aiApiMock,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

const actions: AiWriteAction[] = ["polish", "translate", "shorten", "expand", "continue"];

/** 让流式接口分块回调后 resolve 完整文本 */
function mockStream(text: string) {
  aiApiMock.generateStream.mockImplementation(
    async (_system: string, _prompt: string, onChunk: (delta: string) => void) => {
      onChunk(text.slice(0, 2));
      onChunk(text.slice(2));
      return text;
    },
  );
}

function setup(extra?: { fullText?: string; onApplySummary?: (s: string) => void }) {
  const apply = vi.fn();
  const onApplySummary = extra?.onApplySummary ?? vi.fn();
  const selection = { text: "选中文本", hasSelection: true, fullText: extra?.fullText };
  const { result } = renderHook(() =>
    useAiWrite({ getSelection: () => selection, onApply: apply, onApplySummary }),
  );
  return { result, apply, onApplySummary };
}

describe("useAiWrite 选区与菜单", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("打开菜单读取当前选区", () => {
    const { result } = setup();
    act(() => result.current.openMenu());
    expect(result.current.menuOpen).toBe(true);
    expect(result.current.hasSelection).toBe(true);
  });

  it("无选中时 hasSelection 为 false", () => {
    const apply = vi.fn();
    const { result } = renderHook(() =>
      useAiWrite({ getSelection: () => ({ text: "光标上下文", hasSelection: false }), onApply: apply }),
    );
    act(() => result.current.openMenu());
    expect(result.current.hasSelection).toBe(false);
  });
});

describe("useAiWrite 生成与落笔", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStream("润色后文本");
  });

  it("生成成功后可确认落笔", async () => {
    const { result, apply } = setup();
    act(() => result.current.openMenu());
    act(() => {
      void result.current.run("polish");
    });
    await waitFor(() => expect(result.current.preview).toBe("润色后文本"));
    expect(aiApiMock.generateStream).toHaveBeenCalledTimes(1);
    act(() => result.current.confirm());
    expect(apply).toHaveBeenCalledWith("润色后文本");
    expect(result.current.preview).toBeNull();
  });

  it("取消不落笔", async () => {
    const { result, apply } = setup();
    act(() => result.current.openMenu());
    act(() => {
      void result.current.run("polish");
    });
    await waitFor(() => expect(result.current.preview).toBe("润色后文本"));
    act(() => result.current.cancel());
    expect(apply).not.toHaveBeenCalled();
  });
});

describe("useAiWrite 摘要与错误", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("摘要动作确认时走 onApplySummary", async () => {
    mockStream("摘要内容");
    const { result, onApplySummary, apply } = setup({ fullText: "整篇笔记" });
    act(() => result.current.openMenu());
    act(() => {
      void result.current.run(AI_SUMMARIZE);
    });
    await waitFor(() => expect(result.current.preview).toBe("摘要内容"));
    act(() => result.current.confirm());
    expect(onApplySummary).toHaveBeenCalledWith("摘要内容");
    expect(apply).not.toHaveBeenCalled();
  });

  it("生成失败记录错误且可重试", async () => {
    aiApiMock.generateStream.mockRejectedValueOnce(new Error("网络错误"));
    const { result } = setup();
    act(() => result.current.openMenu());
    act(() => {
      void result.current.run("polish");
    });
    await waitFor(() => expect(result.current.error).toBe("网络错误"));
    mockStream("重试成功");
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.preview).toBe("重试成功"));
  });

  it("所有动作都走流式接口", async () => {
    mockStream("x");
    const { result } = setup();
    act(() => result.current.openMenu());
    for (const action of actions) {
      act(() => {
        void result.current.run(action);
      });
    }
    expect(aiApiMock.generateStream).toHaveBeenCalledTimes(actions.length);
  });
});
