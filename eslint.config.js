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
