import type { ComponentType } from "react";
import { CircleUser, FolderGit2, Languages, Palette, RefreshCw, Sparkles } from "lucide-react";
import type { TranslationKey } from "@/i18n/messages";
import type { SettingsTab } from "@/stores/ui.store";
import { UpdateSettings } from "@/features/update/components/UpdateSettings";
import { AccountSettings } from "./components/AccountSettings";
import { AiSettings } from "./components/AiSettings";
import { LanguageSettings } from "./components/LanguageSettings";
import { RepoManager } from "./components/RepoManager";
import { ThemeSettings } from "./components/ThemeSettings";

export interface SettingsSectionMeta {
  id: SettingsTab;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: ComponentType<{ size?: number | string; className?: string }>;
  component: ComponentType;
}

/** 设置分类注册表：左侧导航与右侧内容区共用同一份定义（策略表）。 */
export const SETTINGS_SECTIONS: ReadonlyArray<SettingsSectionMeta> = [
  { id: "repositories", labelKey: "settings.sectionRepositories", descriptionKey: "settings.repositoriesDescription", icon: FolderGit2, component: RepoManager },
  { id: "appearance", labelKey: "settings.appearance", descriptionKey: "settings.appearanceDescription", icon: Palette, component: ThemeSettings },
  { id: "language", labelKey: "settings.language", descriptionKey: "settings.languageDescription", icon: Languages, component: LanguageSettings },
  { id: "ai", labelKey: "ai.settings", descriptionKey: "settings.aiDescription", icon: Sparkles, component: AiSettings },
  { id: "updates", labelKey: "update.title", descriptionKey: "settings.updatesDescription", icon: RefreshCw, component: UpdateSettings },
  { id: "account", labelKey: "settings.account", descriptionKey: "settings.accountDescription", icon: CircleUser, component: AccountSettings },
];
