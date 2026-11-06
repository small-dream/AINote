import type { ComponentType } from "react";
import { CircleUser, FolderGit2, Languages, LifeBuoy, Lock, Palette, Plug, RefreshCw, Settings2, Sparkles } from "lucide-react";
import type { TranslationKey } from "@/i18n/messages";
import type { SettingsTab } from "@/stores/ui.store";
import { isDesktopApp } from "@/platform/runtime";
import { UpdateSettings } from "@/features/update/components/UpdateSettings";
import { VaultSettings } from "@/features/vault/components/VaultSettings";
import { McpSettings } from "@/features/mcp/components/McpSettings";
import { AccountSettings } from "./components/AccountSettings";
import { CaptureSettings } from "./components/CaptureSettings";
import { AiSettings } from "./components/AiSettings";
import { LanguageSettings } from "./components/LanguageSettings";
import { RepoManager } from "./components/RepoManager";
import { SupportSettings } from "./components/SupportSettings";
import { ThemeSettings } from "./components/ThemeSettings";

export interface SettingsSectionMeta {
  id: SettingsTab;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: ComponentType<{ size?: number | string; className?: string }>;
  component: ComponentType;
  /** 仅在桌面壳展示（移动端不提供入站 MCP 服务）。 */
  desktopOnly?: boolean;
}

const ALL_SETTINGS_SECTIONS: ReadonlyArray<SettingsSectionMeta> = [
  { id: "general", labelKey: "settings.sectionGeneral", descriptionKey: "settings.generalDescription", icon: Settings2, component: CaptureSettings },
  { id: "repositories", labelKey: "settings.sectionRepositories", descriptionKey: "settings.repositoriesDescription", icon: FolderGit2, component: RepoManager },
  { id: "vault", labelKey: "settings.sectionVault", descriptionKey: "settings.vaultDescription", icon: Lock, component: VaultSettings },
  { id: "appearance", labelKey: "settings.appearance", descriptionKey: "settings.appearanceDescription", icon: Palette, component: ThemeSettings },
  { id: "language", labelKey: "settings.language", descriptionKey: "settings.languageDescription", icon: Languages, component: LanguageSettings },
  { id: "ai", labelKey: "ai.settings", descriptionKey: "settings.aiDescription", icon: Sparkles, component: AiSettings },
  { id: "mcp", labelKey: "settings.sectionMcp", descriptionKey: "settings.mcpDescription", icon: Plug, component: McpSettings, desktopOnly: true },
  { id: "updates", labelKey: "update.title", descriptionKey: "settings.updatesDescription", icon: RefreshCw, component: UpdateSettings },
  { id: "support", labelKey: "settings.sectionSupport", descriptionKey: "settings.supportDescription", icon: LifeBuoy, component: SupportSettings },
  { id: "account", labelKey: "settings.account", descriptionKey: "settings.accountDescription", icon: CircleUser, component: AccountSettings },
];

/** 按运行壳过滤设置分类；纯函数便于单测移动端不出现 MCP 入口。 */
export function visibleSettingsSections(isDesktop: boolean): ReadonlyArray<SettingsSectionMeta> {
  return ALL_SETTINGS_SECTIONS.filter((section) => !section.desktopOnly || isDesktop);
}

/** 设置分类注册表：左侧导航与右侧内容区共用同一份定义（策略表）。 */
export const SETTINGS_SECTIONS = visibleSettingsSections(isDesktopApp());
