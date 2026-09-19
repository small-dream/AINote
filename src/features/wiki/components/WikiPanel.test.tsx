import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useToastStore } from "@/stores/toast.store";
import { WikiPanel } from "./WikiPanel";

const wikiApiMock = vi.hoisted(() => ({ index: vi.fn() }));
const noteApiMock = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/api", () => ({ wikiApi: wikiApiMock, noteApi: noteApiMock }));

const NOTES = [
  { path: "a.md", title: "A 笔记", tags: ["x", "y"], links: ["B 笔记", "missing"] },
  { path: "sub/b.md", title: "B 笔记", tags: ["y"], links: [] },
  { path: "c.md", title: "C 笔记", tags: [], links: ["A 笔记"] },
];

function renderPanel(open = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props = {
    repoPath: "/repo",
    path: "a.md",
    open,
    onClose: vi.fn(),
    onOpenNote: vi.fn(),
    draft: "# A 笔记\n\n#x #y",
    kind: "markdown" as const,
    onChange: vi.fn(),
  };
  render(
    <QueryClientProvider client={queryClient}>
      <WikiPanel {...props} />
    </QueryClientProvider>
  );
  return props;
}

describe("WikiPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.getState().clear();
  });

  it("展示当前笔记标签 / 引用 / 反向链接", async () => {
    wikiApiMock.index.mockResolvedValue(NOTES);
    renderPanel();

    expect(await screen.findByText("x")).toBeTruthy();
    expect(screen.getByText("y")).toBeTruthy();
    expect(await screen.findByText("未创建")).toBeTruthy();
    expect(screen.getByText("C 笔记")).toBeTruthy();
  });

  it("输入标签后更新笔记草稿", async () => {
    wikiApiMock.index.mockResolvedValue(NOTES);
    const props = renderPanel();

    const input = await screen.findByLabelText("添加标签（可用逗号分隔）");
    fireEvent.change(input, { target: { value: "#新标签" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(props.onChange).toHaveBeenCalledWith("# A 笔记\n\n#x #y\n\n#新标签");
  });

  it("IME 组合中按 Enter 不提交标签", async () => {
    wikiApiMock.index.mockResolvedValue(NOTES);
    const props = renderPanel();

    const input = await screen.findByLabelText("添加标签（可用逗号分隔）");
    fireEvent.change(input, { target: { value: "新" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });

    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("创建未存在的引用笔记失败时推送错误提示", async () => {
    wikiApiMock.index.mockResolvedValue(NOTES);
    noteApiMock.create.mockRejectedValue(new Error("disk full"));
    renderPanel();

    fireEvent.click(await screen.findByText("创建笔记"));

    await waitFor(() => {
      expect(useToastStore.getState().items.some((item) => item.message.includes("disk full"))).toBe(true);
    });
  });
});

describe("WikiPanel 导航与关闭", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("点击已创建引用打开目标笔记", async () => {
    wikiApiMock.index.mockResolvedValue(NOTES);
    const props = renderPanel();
    await screen.findByText("B 笔记");
    fireEvent.click(screen.getByText("B 笔记"));
    expect(props.onOpenNote).toHaveBeenCalledWith("sub/b.md");
  });

  it("点击反向链接打开对应笔记", async () => {
    wikiApiMock.index.mockResolvedValue(NOTES);
    const props = renderPanel();
    await screen.findByText("C 笔记");
    fireEvent.click(screen.getByText("C 笔记"));
    expect(props.onOpenNote).toHaveBeenCalledWith("c.md");
  });

  it("关闭时返回 null", () => {
    wikiApiMock.index.mockResolvedValue(NOTES);
    const { container } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <WikiPanel repoPath="/repo" path="a.md" open={false} onClose={vi.fn()} onOpenNote={vi.fn()} draft="" kind="markdown" onChange={vi.fn()} />
      </QueryClientProvider>
    );
    expect(container.firstChild).toBeNull();
  });
});
