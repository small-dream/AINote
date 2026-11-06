import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isTauriRuntime } from "@/api";
import { requestEditorReloadIfClean, invalidateWorkspaceQueries } from "@/queries/workspace";
import { useSessionStore } from "@/stores/session.store";
import { useToastStore } from "@/stores/toast.store";
import { useTranslation } from "@/i18n";

/**
 * MCP 写入后的 UI 刷新桥：Rust 侧广播 `mcp:notes-changed`，
 * 这里合并 300ms 内的多次写入，再统一失效查询并请求编辑器重载。
 * 服务器在编辑器有脏草稿时会拒绝写入，因此这里仍保留 `requestEditorReloadIfClean` 守卫。
 */
export function McpChangeBridge() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  useEffect(() => {
    if (!isTauriRuntime()) return undefined;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const paths = new Set<string>();

    const flush = () => {
      timer = undefined;
      const changedPaths = [...paths];
      const count = changedPaths.length;
      const first = changedPaths[0];
      paths.clear();
      invalidateWorkspaceQueries(queryClient);
      const current = useSessionStore.getState().currentNotePath;
      const touchesCurrent =
        current !== null &&
        changedPaths.some(
          (path) => path.replace(/\\/g, "/") === current.replace(/\\/g, "/"),
        );
      // 只重载被 MCP 改写的当前笔记，避免无关写入重置光标/滚动位置。
      if (touchesCurrent) requestEditorReloadIfClean();
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        const message =
          count <= 1 && first
            ? t("mcp.changedOne", { path: first })
            : t("mcp.changed", { count });
        useToastStore.getState().push(message, "info");
      }
    };

    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<{ paths?: string[] }>("mcp:notes-changed", (event) => {
          for (const path of event.payload.paths ?? []) paths.add(path);
          if (timer) clearTimeout(timer);
          timer = setTimeout(flush, 300);
        }),
      )
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
      if (timer) clearTimeout(timer);
    };
  }, [queryClient, t]);

  return null;
}
