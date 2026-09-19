import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "@/stores/ui.store";
import type { UseAiWriteReturn } from "../hooks/useAiWriteTypes";
import { AiWriteControls } from "./AiWriteControls";

const aiApiMock = vi.hoisted(() => ({ getConfig: vi.fn() }));
vi.mock("@/api", () => ({ aiApi: aiApiMock }));

function stubAi(overrides: Partial<UseAiWriteReturn> = {}): UseAiWriteReturn {
  return {
    menuOpen: true,
    open: false,
    loading: false,
    preview: null,
    error: null,
    hasSelection: false,
    applyDocument: false,
    openMenu: vi.fn(),
    closeMenu: vi.fn(),
    run: vi.fn(),
    retry: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(),
    ...overrides,
  };
}

function renderControls(ai: UseAiWriteReturn) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AiWriteControls ai={ai} />
    </QueryClientProvider>
  );
}

describe("AiWriteControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiApiMock.getConfig.mockResolvedValue(null);
    useUiStore.getState().closeAskAi();
  });

  it("点「AI 问答」先关写作菜单再打开问答面板", async () => {
    const closeMenu = vi.fn();
    renderControls(stubAi({ closeMenu }));

    fireEvent.click(await screen.findByText("AI 问答"));

    expect(closeMenu).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().askAiOpen).toBe(true);
  });
});
