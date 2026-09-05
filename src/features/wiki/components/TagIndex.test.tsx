import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TagIndex } from "./TagIndex";
import { useUiStore } from "@/stores/ui.store";

const apiMock = vi.hoisted(() => ({ wikiApi: { index: vi.fn() }, noteApi: { list: vi.fn() } }));
vi.mock("@/api", () => apiMock);

const NOTES = [
  { path: "a.md", title: "A 笔记", tags: ["x", "y"], links: [] },
  { path: "b.md", title: "B 笔记", tags: ["x"], links: [] },
  { path: "c.md", title: "C 笔记", tags: ["z"], links: [] },
];

const NOTE_METAS = [
  { path: "b.md", kind: "markdown", title: "B 笔记", updatedAt: 1 },
  { path: "a.md", kind: "markdown", title: "A 笔记", updatedAt: 2 },
];

function renderIndex() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSelect = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <TagIndex repoPath="/repo" onSelect={onSelect} />
    </QueryClientProvider>
  );
  return { onSelect };
}

describe("TagIndex", () => {
  afterEach(() => useUiStore.setState({ focusedTag: null, sidebarTab: "tree" }));

  it("展示标签云并点击展开对应笔记", async () => {
    apiMock.wikiApi.index.mockResolvedValue(NOTES);
    apiMock.noteApi.list.mockResolvedValue(NOTE_METAS);
    const { onSelect } = renderIndex();

    const tagX = await screen.findByText("x");
    expect(screen.getByText("z")).toBeTruthy();
    fireEvent.click(tagX);

    expect(screen.getByText("A 笔记")).toBeTruthy();
    expect(screen.getByText("B 笔记")).toBeTruthy();
    fireEvent.click(screen.getByText("B 笔记"));
    expect(onSelect).toHaveBeenCalledWith("b.md");
  });

  it("支持搜索标签并展开按更新时间排序的笔记", async () => {
    apiMock.wikiApi.index.mockResolvedValue(NOTES);
    apiMock.noteApi.list.mockResolvedValue(NOTE_METAS);
    renderIndex();

    fireEvent.change(await screen.findByLabelText("搜索标签"), { target: { value: "Y" } });
    expect(screen.queryByText("x")).toBeNull();
    fireEvent.click(screen.getByText("y"));

    const notes = screen.getAllByText("A 笔记");
    expect(notes).toHaveLength(1);
  });

  it("挂载时按 focusedTag 自动展开对应标签", async () => {
    useUiStore.setState({ focusedTag: "x", sidebarTab: "tags" });
    apiMock.wikiApi.index.mockResolvedValue(NOTES);
    renderIndex();

    expect(await screen.findByText("A 笔记")).toBeTruthy();
    expect(screen.getByText("B 笔记")).toBeTruthy();
  });

  it("focusedTag 变化后展开新标签", async () => {
    apiMock.wikiApi.index.mockResolvedValue(NOTES);
    renderIndex();
    await screen.findByText("z");

    useUiStore.setState({ focusedTag: "z" });
    expect(await screen.findByText("C 笔记")).toBeTruthy();
  });

  it("无标签时展示空态", async () => {
    apiMock.wikiApi.index.mockResolvedValue([]);
    apiMock.noteApi.list.mockResolvedValue([]);
    renderIndex();
    expect(await screen.findByText("仓库暂无标签")).toBeTruthy();
  });
});
