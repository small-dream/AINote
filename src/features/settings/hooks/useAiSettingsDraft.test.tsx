import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiSettingsDto } from "@/api";

const saveMock = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null as unknown,
}));

vi.mock("@/api", () => ({
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

vi.mock("@/features/ai/hooks/useAiConfig", () => ({
  useSaveAiConfig: () => saveMock,
}));

import { useAiSettingsDraft } from "./useAiSettingsDraft";

const CONFIG: AiSettingsDto = {
  enabled: true,
  providers: [
    { id: "p1", provider: "openAiCompatible", displayName: "OpenAI", baseUrl: "https://api.example.com", enabled: true, hasKey: true },
    { id: "p2", provider: "ollama", displayName: "Ollama", baseUrl: "http://localhost:11434", enabled: false, hasKey: false },
  ],
  models: [
    { id: "m1", providerId: "p1", modelId: "gpt-5", displayName: "GPT-5", enabled: true },
    { id: "m2", providerId: "p1", modelId: "gpt-5-mini", displayName: "GPT-5 mini", enabled: true },
    { id: "m3", providerId: "p2", modelId: "llama3", displayName: "Llama 3", enabled: true },
  ],
  defaultModelId: "m1",
};

function renderDraft(config: AiSettingsDto = CONFIG) {
  return renderHook(() => useAiSettingsDraft(config));
}

beforeEach(() => {
  saveMock.mutate.mockReset();
});

describe("useAiSettingsDraft removeProvider", () => {
  it("级联删除该服务商下的全部模型，保留其他服务商", () => {
    const { result } = renderDraft();

    act(() => result.current.removeProvider("p1"));

    expect(result.current.settings.providers.map((p) => p.id)).toEqual(["p2"]);
    expect(result.current.settings.models.map((m) => m.id)).toEqual(["m3"]);
  });

  it("默认模型属于被删服务商时清空 defaultModelId", () => {
    const { result } = renderDraft();

    act(() => result.current.removeProvider("p1"));

    expect(result.current.settings.defaultModelId).toBeNull();
  });

  it("默认模型属于其他服务商时保留 defaultModelId", () => {
    const { result } = renderDraft({ ...CONFIG, defaultModelId: "m3" });

    act(() => result.current.removeProvider("p1"));

    expect(result.current.settings.defaultModelId).toBe("m3");
  });

  it("同步清理被删服务商的 keyDrafts，保留其他草稿", () => {
    const { result } = renderDraft();
    act(() => result.current.setKeyDraft("p1", "sk-one"));
    act(() => result.current.setKeyDraft("p2", "sk-two"));

    act(() => result.current.removeProvider("p1"));

    expect(result.current.keyDrafts).toEqual({ p2: "sk-two" });
  });
});
