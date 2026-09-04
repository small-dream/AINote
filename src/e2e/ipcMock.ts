/** 仅测试环境使用（dev + ?e2e）：安装浏览器端 Tauri IPC mock，驱动真实 UI 流程。 */
import { handleCommand } from "./backend";

interface TauriInternals {
  invoke: (cmd: string, args: Record<string, unknown>) => Promise<unknown>;
  convertFileSrc: (filePath: string) => string;
  transformCallback: () => number;
  unregisterCallback: () => void;
  metadata: { currentWindow: { label: string }; currentWebview: { label: string } };
}

const PNG_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

interface MockWindow {
  __E2E_STATE__?: { repoPath: string; assets?: Record<string, string> };
  __E2E_RECORD__?: Array<{ cmd: string; args: Record<string, unknown> }>;
  __TAURI_INTERNALS__?: unknown;
  __TAURI_EVENT_PLUGIN_INTERNALS__?: unknown;
}

function record(cmd: string, args: Record<string, unknown>): void {
  const window = globalThis as unknown as MockWindow;
  window.__E2E_RECORD__ ??= [];
  window.__E2E_RECORD__.push({ cmd, args });
}

function assetDataUri(filePath: string): string {
  const window = globalThis as unknown as MockWindow;
  const assets = window.__E2E_STATE__?.assets ?? {};
  const key = Object.keys(assets).find((name) => filePath.endsWith(`/${name}`));
  return key ? (assets[key] ?? PNG_DATA_URI) : `file://${filePath}`;
}

/** 安装浏览器端 Tauri IPC mock（仅 e2e；install 须在 React 挂载前调用）。 */
export function installE2eIpcMock(): void {
  const window = globalThis as unknown as MockWindow;
  const internals: TauriInternals = {
    invoke: (cmd, args) => { record(cmd, args); return handleCommand(cmd, args); },
    convertFileSrc: (filePath) => assetDataUri(filePath),
    transformCallback: () => 1,
    unregisterCallback: () => undefined,
    metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
  };
  window.__TAURI_INTERNALS__ = internals;
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: () => undefined,
    registerListener: () => undefined,
  };
}
