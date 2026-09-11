import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { useRichTextAssets } from "./useRichTextAssets";

const apiMock = vi.hoisted(() => ({
  onDropPaths: vi.fn(),
  messageOf: vi.fn((error: unknown) => `msg:${String(error)}`),
  assetApi: { importFromPath: vi.fn(), importBytes: vi.fn() },
  syncApi: { commit: vi.fn() },
}));

vi.mock("@/api", () => apiMock);

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function editorMock(dom: HTMLElement) {
  const run = vi.fn();
  const chainMethods = { setImage: vi.fn(() => ({ run })) };
  const editor = {
    chain: vi.fn(() => ({ focus: () => chainMethods })),
    view: { dom },
    isEditable: true,
    isInitialized: true,
    isDestroyed: false,
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as Editor;
  return { editor, chainMethods, run };
}

function imageFile(name: string, size = 3): File {
  return new File([new Uint8Array(size)], name, { type: "image/png" });
}

function captureDrop() {
  let dropCb: ((paths: string[]) => void) | undefined;
  apiMock.onDropPaths.mockImplementation(async (cb: (paths: string[]) => void) => {
    dropCb = cb;
    return vi.fn();
  });
  return () => dropCb;
}

function mockBytesImport(path: string) {
  apiMock.assetApi.importBytes.mockResolvedValue({ path });
  apiMock.syncApi.commit.mockResolvedValue("hash");
}

function resetMocks() {
  vi.clearAllMocks();
  queryClient.clear();
  apiMock.onDropPaths.mockResolvedValue(vi.fn());
}

function mountAssets(editor: Editor | null) {
  return renderHook(() => useRichTextAssets(editor), { wrapper });
}

describe("useRichTextAssets 导入管线", () => {
  beforeEach(resetMocks);

  it("handleFiles 字节导入成功后在编辑器插入图片", async () => {
    mockBytesImport("assets/pasted.png");
    const { editor, chainMethods, run } = editorMock(document.createElement("div"));

    const { result } = mountAssets(editor);
    await act(async () => {
      result.current.handleFiles([imageFile("pasted.png")]);
    });
    await vi.waitFor(() => {
      expect(apiMock.assetApi.importBytes).toHaveBeenCalled();
    });

    expect(chainMethods.setImage).toHaveBeenCalledWith({ src: "assets/pasted.png", alt: "pasted.png" });
    expect(run).toHaveBeenCalled();
  });

  it("导入失败时展示真实错误 message（对齐 Markdown 侧）", async () => {
    apiMock.assetApi.importBytes.mockRejectedValue(new Error("disk full"));
    const { editor } = editorMock(document.createElement("div"));

    const { result } = mountAssets(editor);
    await act(async () => {
      result.current.handleFiles([imageFile("bad.png")]);
    });
    await vi.waitFor(() => {
      expect(result.current.status).toContain("msg:Error: disk full");
    });
  });

  it("超过 20MB 的图片不进入导入管线并提示", async () => {
    const { editor } = editorMock(document.createElement("div"));

    const { result } = mountAssets(editor);
    await act(async () => {
      result.current.handleFiles([imageFile("big.png", 21 * 1024 * 1024)]);
    });

    expect(apiMock.assetApi.importBytes).not.toHaveBeenCalled();
    expect(result.current.status).toContain("big.png");
  });
});

/** view 未就绪的编辑器 mock：view 访问抛错，就绪事件处理器集中收集后由测试触发 */
function pendingViewEditorMock(dom: HTMLElement) {
  const readyHandlers: Array<() => void> = [];
  const editor = {
    chain: vi.fn(() => ({ focus: () => ({ setImage: vi.fn(() => ({ run: vi.fn() })) }) })),
    get view() {
      throw new Error("The editor view is not available");
    },
    isEditable: true,
    isDestroyed: false,
    on: vi.fn((_event: string, handler: () => void) => {
      readyHandlers.push(handler);
    }),
    off: vi.fn(),
  } as unknown as Editor;
  const markReady = () => {
    Object.defineProperty(editor, "view", { get: () => ({ dom }) });
    readyHandlers.forEach((handler) => handler());
  };
  return { editor, markReady };
}

/** 悬停进入编辑器区域后 drop,断言进入导入管线 */
async function expectDropImport(dom: HTMLElement, drop: () => ((paths: string[]) => void) | undefined, path: string) {
  await act(async () => {
    dom.dispatchEvent(new Event("dragenter"));
    drop()?.([path]);
  });
  await vi.waitFor(() => {
    expect(apiMock.assetApi.importFromPath).toHaveBeenCalledWith(path);
  });
}

describe("useRichTextAssets 拖放监听", () => {
  beforeEach(resetMocks);

  it("桌面拖放：仅拖拽悬停在编辑器区域内时才导入", async () => {
    const dom = document.createElement("div");
    document.body.appendChild(dom);
    const { editor, chainMethods } = editorMock(dom);
    const drop = captureDrop();
    apiMock.assetApi.importFromPath.mockResolvedValue({ path: "assets/photo.png" });
    apiMock.syncApi.commit.mockResolvedValue("hash");

    mountAssets(editor);
    await act(async () => {
      await Promise.resolve();
    });

    // 未经过编辑器区域：忽略
    await act(async () => {
      drop()?.(["/Users/jake/photo.png"]);
    });
    expect(apiMock.assetApi.importFromPath).not.toHaveBeenCalled();

    // 悬停进入编辑器区域后再 drop：导入
    await expectDropImport(dom, drop, "/Users/jake/photo.png");
    expect(chainMethods.setImage).toHaveBeenCalledWith({ src: "assets/photo.png", alt: "photo.png" });
    dom.remove();
  });

  it("view 未就绪时延迟挂载，就绪事件后再注册监听（回归：view.dom 早访问崩溃）", async () => {
    const dom = document.createElement("div");
    document.body.appendChild(dom);
    const { editor, markReady } = pendingViewEditorMock(dom);
    const drop = captureDrop();
    apiMock.assetApi.importFromPath.mockResolvedValue({ path: "assets/late.png" });
    apiMock.syncApi.commit.mockResolvedValue("hash");

    // 挂载时不崩溃、不注册
    mountAssets(editor);
    await act(async () => {
      await Promise.resolve();
    });
    expect(apiMock.onDropPaths).not.toHaveBeenCalled();

    // view 就绪事件后注册
    await act(async () => {
      markReady();
      await Promise.resolve();
    });
    expect(apiMock.onDropPaths).toHaveBeenCalled();

    await expectDropImport(dom, drop, "/Users/jake/late.png");
    dom.remove();
  });

  it("无编辑器实例时不注册拖放监听", async () => {
    mountAssets(null);
    await act(async () => {
      await Promise.resolve();
    });
    expect(apiMock.onDropPaths).not.toHaveBeenCalled();
  });
});
