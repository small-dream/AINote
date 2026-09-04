import { defineConfig } from "@playwright/test";

/** 桌面端 E2E：Playwright 驱动 Vite dev 中的真实前端，Tauri IPC 由 e2e mock 提供。
 * 完整 Tauri WebDriver（tauri-driver）运行方式见 docs/ARCHITECTURE.md §E2E。 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:1420",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    port: 1420,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
