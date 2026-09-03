import { create } from "zustand";

interface AiModelState {
  selectedModelId: string | null;
  setSelectedModelId: (modelId: string | null) => void;
}

/** AI 当前临时模型选择（全局 UI 态；默认模型仍在 Rust 设置中裁决） */
export const useAiModelStore = create<AiModelState>((set) => ({
  selectedModelId: null,
  setSelectedModelId: (selectedModelId) => set({ selectedModelId }),
}));
