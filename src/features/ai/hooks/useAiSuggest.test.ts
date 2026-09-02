import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiSuggest } from "./useAiSuggest";

const aiApiMock = vi.hoisted(() => ({
  generateStream: vi.fn(),
}));

vi.mock("@/api", () => ({
  aiApi: aiApiMock,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

function mockStream(text: string) {
  aiApiMock.generateStream.mockImplementation(
    async (_system: string, _prompt: string, onChunk: (delta: string) => void) => {
      onChunk(text);
      return text;
    },
  );
}

function setup() {
  const applyTitle = vi.fn();
  const insertOutline = vi.fn();
  const { result } = renderHook(() =>
    useAiSuggest({ noteText: "整篇笔记", onApplyTitle: applyTitle, onInsertOutline: insertOutline }),
  );
  return { result, applyTitle, insertOutline };
}

describe("useAiSuggest 标题建议", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStream("1. 标题甲\n2. 标题乙");
  });

  it("生成后解析候选，点击应用所选标题", async () => {
    const { result, applyTitle } = setup();
    act(() => result.current.startTitle());
    expect(result.current.kind).toBe("title");
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.titles).toEqual(["标题甲", "标题乙"]);
    act(() => result.current.pickTitle("标题乙"));
    expect(applyTitle).toHaveBeenCalledWith("标题乙");
    expect(result.current.kind).toBeNull();
  });

  it("生成失败后暴露错误并可关闭", async () => {
    aiApiMock.generateStream.mockRejectedValueOnce(new Error("网络错误"));
    const { result } = setup();
    act(() => result.current.startTitle());
    await waitFor(() => expect(result.current.error).toBe("网络错误"));
    act(() => result.current.close());
    expect(result.current.kind).toBeNull();
  });
});

describe("useAiSuggest 大纲建议", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("生成大纲后可插入文末", async () => {
    mockStream("- 第一节\n  - 小节");
    const { result, insertOutline } = setup();
    act(() => result.current.startOutline());
    expect(result.current.kind).toBe("outline");
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.insertOutline());
    expect(insertOutline).toHaveBeenCalledWith("- 第一节\n  - 小节");
    expect(result.current.kind).toBeNull();
  });
});
