import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { SuggestionKeyDownProps } from "@tiptap/suggestion";
import type { SlashCommandDef } from "../utils/slashCommands";
import { useTranslation } from "@/i18n";

interface CommandListProps {
  items: SlashCommandDef[];
  command: (item: SlashCommandDef) => void;
}

export interface CommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

/** 斜杠命令浮层：键盘上下选择 + 回车/点击执行 */
const CommandList = forwardRef<CommandListRef, CommandListProps>(({ items, command }, ref) => {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => { setSelectedIndex(0); }, [items]);

  const selectItem = (index: number) => {
    const item = items[index];
    if (item) command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") { setSelectedIndex((i) => (i + items.length - 1) % items.length); return true; }
      if (event.key === "ArrowDown") { setSelectedIndex((i) => (i + 1) % items.length); return true; }
      if (event.key === "Enter") { selectItem(selectedIndex); return true; }
      return false;
    },
  }));

  if (items.length === 0) {
    return <div className="px-3 py-2 text-xs text-text-tertiary">{t("richtext.noCommands")}</div>;
  }
  return (
    <div className="max-h-64 w-52 overflow-y-auto rounded-lg border border-border bg-bg-primary p-1 shadow-lg">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${index === selectedIndex ? "bg-accent/10 text-accent" : "text-text-primary hover:bg-bg-tertiary"}`}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => selectItem(index)}
          >
            <Icon size={15} />
            <span>{t(item.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
});

export default CommandList;
