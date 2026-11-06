import type { McpToolInfo } from "@/api";
import { useTranslation } from "@/i18n";

/** 工具清单：由 Rust 注册表下发，避免设置页与协议实现漂移。 */
export function McpToolsCard({ tools }: { tools: McpToolInfo[] }) {
  const { t } = useTranslation();
  return (
    <section className="rounded-xl border border-border bg-bg-secondary/60 p-3">
      <h3 className="text-sm font-semibold text-text-primary">{t("mcp.tools")}</h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {tools.map((tool) => (
          <li key={tool.name} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <code className="text-xs text-text-primary">{tool.name}</code>
              <p className="mt-0.5 text-xs text-text-secondary">{tool.description}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                tool.writes ? "bg-accent-soft text-accent" : "bg-bg-tertiary text-text-secondary"
              }`}
            >
              {tool.writes ? t("mcp.toolWrite") : t("mcp.toolRead")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
