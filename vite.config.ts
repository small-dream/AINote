/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: {
    port: 1420,
    strictPort: true,
    // 移动端 dev：Tauri 注入 TAURI_DEV_HOST（局域网 IP），需让 Vite 监听该网卡供真机访问。
    host: process.env.TAURI_DEV_HOST || false,
  },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        // 预览（rehype-katex 静态链）与编辑器软渲染（math.ts 动态 import）共用单一 katex chunk，避免重复打包。
        manualChunks(id) {
          if (id.includes("node_modules/katex/")) return "katex";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    environmentOptions: {
      jsdom: { url: "http://localhost/" },
    },
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
