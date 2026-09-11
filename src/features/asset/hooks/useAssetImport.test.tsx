import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { EditorView } from "@codemirror/view";
import { dispatchFormat } from "@/features/note/hooks/useFormatCommands";
import { useAssetImport } from "./useAssetImport";

const apiMock = vi.hoisted(() => ({
  onDropPaths: vi.fn(),
  messageOf: vi.fn((error: unknown) => String(error)),
  assetApi: { importFromPath: vi.fn(), importBytes: vi.fn() },
  syncApi: { commit: vi.fn() },
}));

vi.mock("@/api", () => apiMock);
vi.mock("@/features/note/hooks/useFormatCommands", () => ({
  dispatchFormat: vi.fn(),
}));

const dispatchFormatMock = vi.mocked(dispatchFormat);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function fakeState(from = 0, to = 0) {
  return { selection: { main: { from, to } } } as never;
}

function viewMock() {
  return { focus: vi.fn(), contentDOM: document.createElement("div") } as unknown as EditorView;
}

function insertResult(name: string, path: string) {
  const fn = dispatchFormatMock.mock.calls[0]?.[1];
  const result = fn?.(fakeState());
  expect(result?.changes).toEqual({ from: 0, to: 0, insert: `![${name}](${path})` });
}

async function mount(view: EditorView | null) {
  const { result } = renderHook(() => useAssetImport(view), { wrapper });
  await act(async () => {
    await Promise.resolve();
  });
  return result;
}

function captureDrop() {
  let dropCb: ((paths: string[]) => void) | undefined;
  apiMock.onDropPaths.mockImplementation(async (cb: (paths: string[]) => void) => {
    dropCb = cb;
    return vi.fn();
  });
  return () => dropCb;
}

describe("useAssetImport 拖放导入", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("注册拖放监听，仅悬停在编辑器区域时导入并在成功后于光标处插入引用", async () => {
    const view = viewMock();
    const drop = captureDrop();
    apiMock.assetApi.importFromPath.mockResolvedValue({ path: "assets/photo.png" });
    apiMock.syncApi.commit.mockResolvedValue("hash");

    await mount(view);

    // 未悬停编辑器区域（如拖向侧边栏）时忽略
    await act(async () => {
      drop()?.(["/Users/jake/photo.png"]);
    });
    expect(apiMock.assetApi.importFromPath).not.toHaveBeenCalled();

    // 悬停进入编辑器区域后 drop：导入并插入
    await act(async () => {
      view.contentDOM.dispatchEvent(new Event("dragenter"));
      drop()?.(["/Users/jake/photo.png"]);
    });
    await vi.waitFor(() => {
      expect(apiMock.syncApi.commit).toHaveBeenCalledWith("note: asset assets/photo.png");
    });

    expect(apiMock.assetApi.importFromPath).toHaveBeenCalledWith("/Users/jake/photo.png");
    insertResult("photo.png", "assets/photo.png");
    expect(view.focus).toHaveBeenCalled();
  });
});

function imageFile(name: string, bytes: number[] = [1, 2, 3]): File {
  return new File([new Uint8Array(bytes)], name, { type: "image/png" });
}

function pasteEvent(files: File[]): ClipboardEvent {
  const event = new Event("paste", { cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, "clipboardData", { value: { files } });
  return event;
}

function mockBytesImport(path: string) {
  apiMock.assetApi.importBytes.mockResolvedValue({ path });
  apiMock.syncApi.commit.mockResolvedValue("hash");
}

describe("useAssetImport 文件选择器与边界", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("工具栏文件选择器走字节导入并插入引用", async () => {
    mockBytesImport("assets/pasted.png");
    const result = await mount(viewMock());

    await act(async () => {
      result.current.handleFiles([imageFile("pasted.png")]);
    });
    await vi.waitFor(() => {
      expect(apiMock.assetApi.importBytes).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), "pasted.png");
    });

    insertResult("pasted.png", "assets/pasted.png");
  });

  it("无编辑器视图时不注册拖放监听", async () => {
    await mount(null);
    expect(apiMock.onDropPaths).not.toHaveBeenCalled();
  });

  it("粘贴剪贴板图片走字节导入并阻止默认粘贴", async () => {
    mockBytesImport("assets/clip.png");
    const view = viewMock();
    await mount(view);
    const event = pasteEvent([imageFile("clip.png", [1])]);

    await act(async () => {
      view.contentDOM.dispatchEvent(event);
    });
    await vi.waitFor(() => {
      expect(apiMock.assetApi.importBytes).toHaveBeenCalled();
    });

    expect(event.defaultPrevented).toBe(true);
    insertResult("clip.png", "assets/clip.png");
  });

  it("粘贴纯文本不拦截默认行为", async () => {
    const view = viewMock();
    const result = await mount(view);
    const event = pasteEvent([]);

    await act(async () => {
      view.contentDOM.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
    expect(apiMock.assetApi.importBytes).not.toHaveBeenCalled();
    expect(result.current.status).toBeNull();
  });

  it("粘贴超过 20MB 的图片不导入并提示大小限制", async () => {
    const view = viewMock();
    const result = await mount(view);
    const big = new File([new Uint8Array(21 * 1024 * 1024)], "huge.png", { type: "image/png" });

    await act(async () => {
      view.contentDOM.dispatchEvent(pasteEvent([big]));
    });

    expect(apiMock.assetApi.importBytes).not.toHaveBeenCalled();
    expect(result.current.status).toContain("huge.png");
  });
});
