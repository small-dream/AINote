/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";

function pdfjsAssets(): Plugin {
  const source = path.resolve(import.meta.dirname, "node_modules/pdfjs-dist");
  const allowedDirs = ["cmaps", "standard_fonts"].map((name) => path.join(source, name));
  let outDir = path.resolve(import.meta.dirname, "dist");
  let copyOnClose = true;
  return {
    name: "ainote-pdfjs-assets",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
      copyOnClose = config.command === "build" && config.mode !== "test";
    },
    configureServer(server) {
      server.middlewares.use("/pdfjs", (req, res, next) => {
        const relative = decodeURIComponent((req.url ?? "").split("?")[0] ?? "").replace(/^\/+/, "");
        const target = path.resolve(source, relative);
        if (!allowedDirs.some((dir) => target === dir || target.startsWith(`${dir}${path.sep}`))) return next();
        fs.readFile(target, (error, bytes) => {
          if (error) return next();
          res.setHeader("Content-Type", "application/octet-stream");
          res.end(bytes);
        });
      });
    },
    closeBundle() {
      if (!copyOnClose) return;
      for (const dir of allowedDirs) {
        fs.cpSync(dir, path.join(outDir, "pdfjs", path.basename(dir)), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), pdfjsAssets()],
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
