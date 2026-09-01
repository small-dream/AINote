import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TagIndex } from "./TagIndex";
import { useUiStore } from "@/stores/ui.store";

const wikiApiMock = vi.hoisted(() => ({ index: vi.fn() }));
vi.mock("@/api", () => ({ wikiApi: wikiApiMock }));

const NOTES = [
  { path: "a.md", title: "A 笔记", tags: ["x", "y"], links: [] },
  { path: "b.md", title: "B 笔记", tags: ["x"], links: [] },
  { path: "c.md", title: "C 笔记", tags: ["z"], links: [] },
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
    wikiApiMock.index.mockResolvedValue(NOTES);
    const { onSelect } = renderIndex();

    const tagX = await screen.findByText("x");
    expect(screen.getByText("z")).toBeTruthy();
    fireEvent.click(tagX);

    expect(screen.getByText("A 笔记")).toBeTruthy();
    expect(screen.getByText("B 笔记")).toBeTruthy();
    fireEvent.click(screen.getByText("B 笔记"));
    expect(onSelect).toHaveBeenCalledWith("b.md");
  });

  it("挂载时按 focusedTag 自动展开对应标签", async () => {
    useUiStore.setState({ focusedTag: "x", sidebarTab: "tags" });
    wikiApiMock.index.mockResolvedValue(NOTES);
    renderIndex();

    expect(await screen.findByText("A 笔记")).toBeTruthy();
    expect(screen.getByText("B 笔记")).toBeTruthy();
  });

  it("focusedTag 变化后展开新标签", async () => {
    wikiApiMock.index.mockResolvedValue(NOTES);
    renderIndex();
    await screen.findByText("z");

    useUiStore.setState({ focusedTag: "z" });
    expect(await screen.findByText("C 笔记")).toBeTruthy();
  });

  it("无标签时展示空态", async () => {
    wikiApiMock.index.mockResolvedValue([]);
    renderIndex();
    expect(await screen.findByText("仓库暂无标签")).toBeTruthy();
  });
});
