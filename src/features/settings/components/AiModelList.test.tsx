import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AiModelDto } from "@/api";
import { AiModelList } from "./AiModelList";

const model: AiModelDto = {
  id: "model-1",
  providerId: "provider-1",
  modelId: "gpt-test",
  displayName: "测试模型",
  enabled: true,
};

describe("AiModelList 紧凑模型行", () => {
  it("支持编辑显示名、切换启用、设置默认和删除", () => {
    const onUpdate = vi.fn();
    const onRemove = vi.fn();
    const onSetDefault = vi.fn();
    render(<AiModelList models={[model]} defaultModelId={null} onUpdate={onUpdate} onRemove={onRemove} onSetDefault={onSetDefault} />);

    fireEvent.change(screen.getByLabelText("模型显示名"), { target: { value: "新名称" } });
    fireEvent.click(screen.getByLabelText("启用此模型"));
    fireEvent.click(screen.getByLabelText("设为默认"));
    fireEvent.click(screen.getByLabelText("删除模型"));

    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onSetDefault).toHaveBeenCalledWith("model-1");
    expect(onRemove).toHaveBeenCalledWith("model-1");
    expect(screen.getByTitle("gpt-test")).toBeTruthy();
  });
});
