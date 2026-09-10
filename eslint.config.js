import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "src-tauri/target"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["src/**/*.{ts,tsx}"],
    ...reactHooks.configs.flat.recommended,
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      // anti-corruption hard limits (docs/CODING_STANDARDS.md section 0)
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 60, skipBlankLines: true, skipComments: true }],
      complexity: ["error", 12],
      "@typescript-eslint/no-explicit-any": "error",
      // 渲染库会把整个 props 透传给自定义组件（如 react-markdown 的 `node`），
      // 解构后丢弃个别字段是惯用写法：允许用 `_` 前缀显式标记「有意忽略」。
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
      // dependency boundary: Tauri IPC only inside src/api/
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["@tauri-apps/api*"], message: "Tauri IPC only allowed inside src/api/" },
        ],
      }],
    },
  },
  {
    files: ["src/api/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  }
);
