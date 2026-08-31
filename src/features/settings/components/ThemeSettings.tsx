import { Moon, Sun } from "lucide-react";
import { useUiStore, type Theme } from "@/stores/ui.store";

const THEME_OPTIONS: ReadonlyArray<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "亮色", icon: Sun },
  { value: "dark", label: "暗色", icon: Moon },
];

/** 设置页外观区块：亮色 / 暗色主题切换（全局 UI 态，偏好持久化到本地） */
export function ThemeSettings() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold">外观</h3>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="主题">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
          const selected = theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(value)}
              className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                selected
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
