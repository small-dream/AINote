import { act, renderHook, waitFor, type RenderHookResult } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VoiceStreamEvent, VoiceSupport } from "@/api/voice.types";
import type { VoiceStatus } from "./useVoiceInput";
import { useVoiceInput } from "./useVoiceInput";

let startListener: ((event: VoiceStreamEvent) => void) | null = null;

const supportMock = vi.fn<() => Promise<VoiceSupport>>();
const startMock = vi.fn<(sessionId: string, onDevice: boolean) => Promise<null>>();
const finishMock = vi.fn<(sessionId: string) => Promise<null>>();
const cancelMock = vi.fn<(sessionId: string) => Promise<null>>();

vi.mock("@/api", () => ({
  voiceApi: {
    support: () => supportMock(),
    start: (sessionId: string, onDevice: boolean, onEvent: (event: VoiceStreamEvent) => void) => {
      return startMock(sessionId, onDevice).then(() => {
        startListener = onEvent;
        return null;
      });
    },
    finish: (sessionId: string) => finishMock(sessionId),
    cancel: (sessionId: string) => cancelMock(sessionId),
  },
}));

type VoiceHook = RenderHookResult<{ status: VoiceStatus; partial: string; consentOpen: boolean; supported: boolean; toggle: () => Promise<void>; stop: () => Promise<void>; confirmNetwork: () => Promise<void>; cancelConsent: () => void }, { notePath: string | null }>;

function setup(): { hook: VoiceHook; insertText: ReturnType<typeof vi.fn> } {
  const insertText = vi.fn();
  const hook = renderHook(({ notePath }) => useVoiceInput({ insertText, notePath, enabled: true }), {
    initialProps: { notePath: "daily/a.md" as string | null },
  });
  return { hook, insertText };
}

beforeEach(() => {
  vi.clearAllMocks();
  startListener = null;
  supportMock.mockResolvedValue({ supported: true, onDevice: true });
  startMock.mockResolvedValue(null);
  finishMock.mockResolvedValue(null);
  cancelMock.mockResolvedValue(null);
});

function emit(event: VoiceStreamEvent) {
  act(() => startListener?.(event));
}

function currentSessionId(): string {
  const call = startMock.mock.calls.at(-1);
  if (!call) throw new Error("voice session not started");
  return call[0];
}

describe("useVoiceInput 能力与启动", () => {
  it("on-device 可用时直接以本机识别启动", async () => {
    const { hook } = setup();
    await act(async () => {
      await hook.result.current.toggle();
    });
    expect(startMock).toHaveBeenCalledWith(expect.any(String), true);
    expect(hook.result.current.status).toBe("listening");
    expect(hook.result.current.consentOpen).toBe(false);
  });

  it("on-device 不可用时先弹联网识别同意框，确认后才启动", async () => {
    supportMock.mockResolvedValue({ supported: true, onDevice: false });
    const { hook } = setup();
    await act(async () => {
      await hook.result.current.toggle();
    });
    expect(startMock).not.toHaveBeenCalled();
    expect(hook.result.current.consentOpen).toBe(true);

    await act(async () => {
      await hook.result.current.confirmNetwork();
    });
    expect(startMock).toHaveBeenCalledWith(expect.any(String), false);
    expect(hook.result.current.consentOpen).toBe(false);
  });

  it("联网识别启动失败时关闭同意框并回到空闲", async () => {
    supportMock.mockResolvedValue({ supported: true, onDevice: false });
    startMock.mockRejectedValueOnce({
      code: "VOICE_9002",
      kind: "unknown",
      message: "no selected recognition service",
      retriable: false,
    });
    const { hook } = setup();
    await act(async () => {
      await hook.result.current.toggle();
    });
    expect(hook.result.current.consentOpen).toBe(true);

    await act(async () => {
      await hook.result.current.confirmNetwork();
    });
    expect(hook.result.current.consentOpen).toBe(false);
    expect(hook.result.current.status).toBe("idle");
  });

  it("不支持语音识别时不启动会话", async () => {
    supportMock.mockResolvedValue({ supported: false, onDevice: false });
    const { hook } = setup();
    await act(async () => {
      await hook.result.current.toggle();
    });
    expect(startMock).not.toHaveBeenCalled();
    expect(hook.result.current.supported).toBe(false);
  });
});

describe("useVoiceInput 会话事件与停止", () => {
  it("部分转写驱动状态，定稿插入光标处", async () => {
    const { hook, insertText } = setup();
    await act(async () => {
      await hook.result.current.toggle();
    });
    const sessionId = currentSessionId();
    emit({ sessionId, kind: "partial", text: "今天" });
    expect(hook.result.current.partial).toBe("今天");
    expect(hook.result.current.status).toBe("listening");

    emit({ sessionId, kind: "final", text: "今天天气不错" });
    expect(insertText).toHaveBeenCalledWith("今天天气不错");
    expect(hook.result.current.partial).toBe("");
    expect(hook.result.current.status).toBe("listening");
  });

  it("stopped 事件把会话归位到 idle", async () => {
    const { hook } = setup();
    await act(async () => {
      await hook.result.current.toggle();
    });
    emit({ sessionId: currentSessionId(), kind: "stopped" });
    expect(hook.result.current.status).toBe("idle");
    expect(hook.result.current.partial).toBe("");
  });

  it("引擎失败提示错误并归位", async () => {
    const { hook } = setup();
    await act(async () => {
      await hook.result.current.toggle();
    });
    emit({ sessionId: currentSessionId(), kind: "failed", code: "noMatch", message: "no match" });
    expect(hook.result.current.status).toBe("idle");
  });
});

describe("useVoiceInput 完成、取消与生命周期", () => {
  it("正常停止调用 finish，stopped 事件归位", async () => {
    const { hook } = setup();
    await act(async () => {
      await hook.result.current.toggle();
    });
    const sessionId = currentSessionId();
    await act(async () => {
      await hook.result.current.stop();
    });
    expect(finishMock).toHaveBeenCalledWith(sessionId);
    expect(hook.result.current.status).toBe("stopping");
    emit({ sessionId, kind: "stopped" });
    expect(hook.result.current.status).toBe("idle");
  });

  it("切换笔记调用 cancel，并丢弃旧会话 late final", async () => {
    const { hook, insertText } = setup();
    await act(async () => {
      await hook.result.current.toggle();
    });
    const oldSessionId = currentSessionId();
    await act(async () => {
      hook.rerender({ notePath: "daily/b.md" });
    });
    await waitFor(() => expect(cancelMock).toHaveBeenCalledWith(oldSessionId));

    emit({ sessionId: oldSessionId, kind: "final", text: "旧笔记内容" });
    expect(insertText).not.toHaveBeenCalled();
    expect(hook.result.current.status).toBe("idle");
  });

  it("页面隐藏时取消会话", async () => {
    const { hook } = setup();
    await act(async () => {
      await hook.result.current.toggle();
    });
    const sessionId = currentSessionId();
    const original = Object.getOwnPropertyDescriptor(document, "visibilityState");
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await waitFor(() => expect(cancelMock).toHaveBeenCalledWith(sessionId));
    if (original) Object.defineProperty(document, "visibilityState", original);
  });

  it("未开始时停止是幂等空操作", async () => {
    const { hook } = setup();
    await act(async () => {
      await hook.result.current.stop();
    });
    expect(finishMock).not.toHaveBeenCalled();
    expect(hook.result.current.status).toBe("idle");
  });
});
