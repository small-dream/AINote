import { ClipboardCopy, Copy, SquareArrowOutUpRight, TextSelect, type LucideIcon } from "lucide-react";
import type { ContextMenuItem } from "@/components/molecules/EditorContextMenu";
import { EditorContextMenu } from "@/components/molecules/EditorContextMenu";
import { useTranslation } from "@/i18n";
import type { NoteTheme } from "@/stores/ui.store";
import { WIKI_PROTOCOL } from "@/features/wiki/utils/wiki";
import type { usePreviewContextMenu } from "../hooks/usePreviewContextMenu";

type PreviewMenu = ReturnType<typeof usePreviewContextMenu>;

interface PreviewContextMenuProps {
  menu: PreviewMenu;
  noteTheme: NoteTheme;
}

/** 预览右键菜单：只保留阅读上下文中的复制、链接与双链操作。 */
export function PreviewContextMenu({ menu, noteTheme }: PreviewContextMenuProps) {
  const { t } = useTranslation();
  const items = createItems(menu, t);
  return <EditorContextMenu position={menu.position} label={t("editor.contextMenu")} items={items} noteTheme={noteTheme} onClose={menu.close} />;
}

type ContextMenuTranslator = ReturnType<typeof useTranslation>["t"];

function createItems(menu: PreviewMenu, t: ContextMenuTranslator): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    action("copy", Copy, t("editor.copy"), menu.copySelection, !menu.hasSelection),
    { key: "select-all", icon: TextSelect, label: t("editor.selectAll"), onSelect: menu.selectAll },
  ];

  if (menu.position?.href) {
    items.push(
      { kind: "separator", key: "link-separator" },
      ...linkItems(menu, t),
    );
  }
  return items;
}

function linkItems(menu: PreviewMenu, t: ContextMenuTranslator): ContextMenuItem[] {
  const href = menu.position?.href ?? "";
  const isWiki = href.startsWith(WIKI_PROTOCOL);
  return [
    action(isWiki ? "open-wiki" : "open-link", SquareArrowOutUpRight, isWiki ? t("preview.openWiki") : t("preview.openLink"), menu.openLink),
    action("copy-link", ClipboardCopy, t("preview.copyLink"), menu.copyLink),
  ];
}

function action(key: string, icon: LucideIcon, label: string, onSelect: () => void, disabled = false): ContextMenuItem {
  return { key, icon, label, onSelect, ...(disabled ? { disabled: true } : {}) };
}
