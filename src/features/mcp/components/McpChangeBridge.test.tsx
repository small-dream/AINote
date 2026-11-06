import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNoteReloadStore } from "@/stores/note-reload.store";
import { useSessionStore } from "@/stores/session.store";
import { useToastStore } from "@/stores/toast.store";

const listenMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/event", () => ({ listen: listenMock }));
vi.mock("@/api", () => ({ isTauriRuntime: () => true }));

import { McpChangeBridge } from "./McpChangeBridge";

describe("McpChangeBridge", () => {
  afterEach(() => {
    vi.clearAllMocks();
    useToastStore.getState().clear();
    useSessionStore.setState({ currentNotePath: null });
  });

  it("invalidates workspace queries, reloads the editor and shows a toast", async () => {
    useSessionStore.setState({ currentNotePath: "daily/a.md" });
    let handler: ((event: { payload: { paths: string[] } }) => void) | undefined;
    listenMock.mockImplementation(async (_name: string, callback: typeof handler) => {
      handler = callback;
      return () => undefined;
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const before = useNoteReloadStore.getState().epoch;
    const view = render(
      <QueryClientProvider client={queryClient}>
        <McpChangeBridge />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(listenMock).toHaveBeenCalled());
    handler?.({ payload: { paths: ["daily/a.md"] } });
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    expect(useNoteReloadStore.getState().epoch).toBeGreaterThan(before);
    expect(useToastStore.getState().items.length).toBe(1);
    view.unmount();
  });
});
