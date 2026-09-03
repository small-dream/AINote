import { describe, expect, it } from "vitest";
import type { AiSettingsDto } from "@/api";
import { resolveModelSelection, usableAiModels } from "./models";

const settings: AiSettingsDto = {
  enabled: true,
  defaultModelId: "model-cloud",
  providers: [
    { id: "cloud", provider: "openAiCompatible", displayName: "DeepSeek", baseUrl: "", enabled: true, hasKey: true },
    { id: "local", provider: "ollama", displayName: "Ollama", baseUrl: "", enabled: true, hasKey: false },
  ],
  models: [
    { id: "model-cloud", providerId: "cloud", modelId: "deepseek-chat", displayName: "DeepSeek Chat", enabled: true },
    { id: "model-off", providerId: "cloud", modelId: "off", displayName: "Off", enabled: false },
    { id: "model-local", providerId: "local", modelId: "llama3", displayName: "Llama 3", enabled: true },
  ],
};

describe("AI 模型选项", () => {
  it("过滤停用模型、停用 Provider 和缺少 Key 的云端模型", () => {
    const cloudProvider = settings.providers[0];
    const noKey: AiSettingsDto = { ...settings, providers: cloudProvider ? [{ ...cloudProvider, hasKey: false }] : [] };
    expect(usableAiModels(noKey)).toEqual([]);
    expect(usableAiModels(settings).map((model) => model.id)).toEqual(["model-cloud", "model-local"]);
  });

  it("优先使用默认模型，必要时回退第一个可用模型", () => {
    expect(resolveModelSelection(settings, null)).toBe("model-cloud");
    expect(resolveModelSelection(settings, "missing")).toBe("model-cloud");
    expect(resolveModelSelection({ ...settings, defaultModelId: "missing" }, null)).toBe("model-cloud");
  });
});
