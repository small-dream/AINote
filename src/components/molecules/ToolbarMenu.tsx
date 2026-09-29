import { useCallback, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import { Tooltip } from "@/components/atoms/Tooltip";
import { useAnchoredLayer } from "@/hooks/useAnchoredLayer";
import { useMenuKeyboardNav } from "@/hooks/useMenuKeyboardNav";

export interface ToolbarMenuItem {
  key: string;
  icon: LucideIcon;
  label: string;
  /** 辅助说明（如禁用原因、未配置引导）：小字展示并写入 title，不进无障碍名称 */
  hint?: string | undefined;
  /** danger：危险操作（如丢弃改动），整项用 danger 色 */
  tone?: "danger" | undefined;
  /** 选中态（如当前标题级别）：accent 底 + 对勾；menuitemradio 下映射为 aria-checked */
  active?: boolean | undefined;
  /** 无障碍语义：默认 menuitem；「多选一」列表（如标题级别）传 menuitemradio 走 aria-checked */
  role?: "menuitem" | "menuitemradio" | undefined;
  disabled?: boolean | undefined;
  onSelect?: (() => void) | undefined;
  /** 提供时渲染为文件选择器项（button + 隐藏 input），选中文件后关闭菜单 */
  onPickFiles?: ((files: File[]) => void) | undefined;
  /** 文件选择器项的 accept（如 "image/*"） */
  accept?: string | undefined;
  /** 提供时点击切换到子视图（不关闭菜单），内容选中后由 close 收尾 */
  submenu?: ((close: () => void) => ReactNode) | undefined;
}

export type ToolbarMenuEntry = ToolbarMenuItem | { type: "divider" };

interface ToolbarMenuProps {
  /** bar 变体必传；format 变体提供 text 文字触发器时可省略 */
  icon?: LucideIcon | undefined;
  label: string;
  entries: ToolbarMenuEntry[];
  /** bar：顶栏 IconButton；format：格式栏小按钮（onMouseDown 保住编辑器焦点与选区） */
  variant?: "bar" | "format";
  /** format 变体的文字触发器内容（如标题级别选择器）；提供时图标让位给文字 + 下拉箭头 */
  text?: string | undefined;
  /** 触发器选中态（如当前标题非正文） */
  active?: boolean | undefined;
  width?: number;
  /** 面板水平对齐：end 右缘对齐触发器（顶栏右侧），start 左缘对齐（左侧导航轨） */
  align?: "start" | "end";
  /** 触发器位于 overflow 裁剪的滚动容器内时，tooltip portal 到 body */
  tooltipPortal?: boolean | undefined;
  /** 完全自定义触发器（如导航轨带徽标的按钮）；仍渲染在锚点容器内 */
  trigger?: ((state: { open: boolean; toggle: () => void }) => ReactNode) | undefined;
  /** 锚点容器（flex item）附加类，如分组间距 */
  className?: string | undefined;
}

const ITEM_BASE_CLASS = "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors disabled:pointer-events-none disabled:opacity-40";

function findSubmenu(entries: ToolbarMenuEntry[], key: string | null): ToolbarMenuItem | null {
  if (!key) return null;
  return entries.find((entry): entry is ToolbarMenuItem => "key" in entry && entry.key === key) ?? null;
}

function itemClass(item: Pick<ToolbarMenuItem, "tone" | "active">): string {
  if (item.active) return `${ITEM_BASE_CLASS} bg-accent/10 text-accent`;
  return `${ITEM_BASE_CLASS} ${item.tone === "danger" ? "text-danger hover:bg-danger/10 focus-visible:bg-danger/10" : "text-text-primary hover:bg-bg-secondary focus-visible:bg-bg-secondary"}`;
}

/** 工具栏下拉菜单：顶栏溢出、格式栏插入/选择器、导航轨分组入口共用；portal 定位、点外部/Escape 关闭、移动端返回键关闭。 */
export function ToolbarMenu({ icon, label, entries, variant = "bar", text, active = false, width = 208, align, tooltipPortal = false, trigger, className = "" }: ToolbarMenuProps) {
  const [open, setOpen] = useState(false);
  const [submenuKey, setSubmenuKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const close = useCallback(() => {
    setOpen(false);
    setSubmenuKey(null);
  }, []);
  const back = useCallback(() => setSubmenuKey(null), []);
  const { menuRef, position, maxHeight } = useAnchoredLayer({ triggerRef: rootRef, open, close, width, align: align ?? (variant === "bar" ? "end" : "start") });
  const onKeyDown = useMenuKeyboardNav({ panelRef: menuRef, triggerRef: rootRef, open, submenuKey, close, onBack: back });
  const submenu = findSubmenu(entries, submenuKey);
  const toggle = () => setOpen((value) => !value);
  return (
    <div ref={rootRef} className={`relative shrink-0 ${className}`}>
      <MenuTrigger icon={icon} label={label} variant={variant} text={text} active={active} open={open} toggle={toggle} tooltipPortal={tooltipPortal} trigger={trigger} />
      {open
        ? createPortal(
            <ToolbarMenuPanel menuRef={menuRef} position={position} maxHeight={maxHeight} label={submenu?.label ?? label} entries={entries} submenu={submenu} onBack={back} onSubmenu={setSubmenuKey} onClose={close} onKeyDown={onKeyDown} />,
            document.body,
          )
        : null}
    </div>
  );
}

interface MenuTriggerProps extends Pick<ToolbarMenuProps, "icon" | "label" | "text" | "trigger"> {
  variant: "bar" | "format";
  active: boolean;
  open: boolean;
  toggle: () => void;
  tooltipPortal: boolean;
}

function MenuTrigger({ icon, label, variant, text, active, open, toggle, tooltipPortal, trigger }: MenuTriggerProps) {
  if (trigger) return <>{trigger({ open, toggle })}</>;
  if (variant === "bar") return icon ? <IconButton icon={icon} label={label} tooltipPlacement="bottom" tooltipPortal={tooltipPortal} active={open} aria-haspopup="menu" aria-expanded={open} onClick={toggle} /> : null;
  return <FormatMenuTrigger icon={icon} label={label} text={text} active={active} open={open} portal={tooltipPortal} onToggle={toggle} />;
}

function FormatMenuTrigger({ icon: Icon, label, text, active, open, portal, onToggle }: { icon?: LucideIcon | undefined; label: string; text?: string | undefined; active: boolean; open: boolean; portal: boolean; onToggle: () => void }) {
  const state = open || active ? "bg-accent-soft text-accent" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary";
  return (
    <Tooltip content={label} placement="bottom" portal={portal}>
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onMouseDown={(event) => event.preventDefault()} onClick={onToggle} className={`flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-1.5 text-xs font-medium transition-colors duration-120 ${state}`}>
        {text || !Icon ? null : <Icon size={16} />}
        {text ? <span>{text}</span> : null}
        {text ? <ChevronDown size={13} aria-hidden="true" /> : null}
      </button>
    </Tooltip>
  );
}

interface ToolbarMenuPanelProps {
  menuRef: RefObject<HTMLDivElement | null>;
  position: CSSProperties;
  maxHeight: number | null;
  label: string;
  entries: ToolbarMenuEntry[];
  submenu: ToolbarMenuItem | null;
  onBack: () => void;
  onSubmenu: (key: string) => void;
  onClose: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

function ToolbarMenuPanel({ menuRef, position, maxHeight, label, entries, submenu, onBack, onSubmenu, onClose, onKeyDown }: ToolbarMenuPanelProps) {
  return (
    <div ref={menuRef} role="menu" aria-label={label} onKeyDown={onKeyDown} style={{ ...position, maxHeight: maxHeight ?? undefined }} className="fixed z-50 w-52 overflow-y-auto rounded-lg border border-border bg-bg-primary p-1.5 shadow-sm">
      {submenu ? (
        <>
          <button type="button" role="menuitem" tabIndex={-1} onClick={onBack} className={itemClass({})}>
            <ChevronLeft size={16} />
            <span className="flex-1">{submenu.label}</span>
          </button>
          <MenuDivider />
          {submenu.submenu?.(onClose)}
        </>
      ) : (
        entries.map((entry, index) => ("type" in entry ? <MenuDivider key={`divider-${index}`} /> : <MenuItemView key={entry.key} item={entry} onSubmenu={onSubmenu} onClose={onClose} />))
      )}
    </div>
  );
}

function MenuDivider() {
  return <div role="separator" className="mx-1 my-1 h-px bg-border" />;
}

function MenuItemView({ item, onSubmenu, onClose }: { item: ToolbarMenuItem; onSubmenu: (key: string) => void; onClose: () => void }) {
  if (item.onPickFiles) return <FilePickItem item={item} onClose={onClose} />;
  return (
    <button
      type="button"
      role={item.role ?? "menuitem"}
      aria-checked={item.role === "menuitemradio" ? item.active === true : undefined}
      aria-current={item.role === "menuitemradio" ? undefined : item.active || undefined}
      data-menu-key={item.key}
      tabIndex={-1}
      disabled={item.disabled}
      title={item.hint}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        if (item.submenu) {
          onSubmenu(item.key);
          return;
        }
        onClose();
        item.onSelect?.();
      }}
      className={itemClass(item)}
    >
      <item.icon size={16} />
      <span className="flex-1">
        {item.label}
        {item.hint ? (
          <span aria-hidden="true" className="block text-[10px] leading-snug text-text-tertiary">
            {item.hint}
          </span>
        ) : null}
      </span>
      {item.submenu ? <ChevronRight size={14} className="text-text-tertiary" /> : null}
      {item.active ? <Check size={14} aria-hidden="true" /> : null}
    </button>
  );
}

/** 文件选择器菜单项：button 保证键盘可达（Enter 触发），ref 程序化点击隐藏 input */
function FilePickItem({ item, onClose }: { item: ToolbarMenuItem; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) {
      onClose();
      item.onPickFiles?.(files);
    }
  };
  return (
    <button type="button" role={item.role ?? "menuitem"} data-menu-key={item.key} tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => inputRef.current?.click()} className={itemClass(item)}>
      <item.icon size={16} />
      <span className="flex-1">{item.label}</span>
      <input ref={inputRef} type="file" multiple tabIndex={-1} aria-hidden="true" accept={item.accept} className="hidden" onChange={handleChange} />
    </button>
  );
}
