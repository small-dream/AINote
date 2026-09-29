import { useCallback, useEffect, useRef, type KeyboardEvent, type RefObject } from "react";

/** 面板内可参与焦点漫游的项：菜单项与单选菜单项，顺序即 DOM 顺序 */
const ITEM_SELECTOR = '[role="menuitem"],[role="menuitemradio"]';

interface UseMenuKeyboardNavOptions {
  /** 浮层根节点（role="menu" 容器） */
  panelRef: RefObject<HTMLElement | null>;
  /** 触发按钮的包裹元素：关闭后把焦点还给它，避免焦点掉回 body */
  triggerRef: RefObject<HTMLElement | null>;
  open: boolean;
  /** 非空表示当前展示的是子视图（子视图内 Escape 先退回主列表） */
  submenuKey: string | null;
  close: () => void;
  /** 从子视图退回主列表 */
  onBack: () => void;
}

/** 可聚焦的菜单项：跳过禁用项，保留 DOM 顺序 */
function menuItems(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter((item) => !item.hasAttribute("disabled"));
}

/** 命中方向键时的目标下标：找不到当前项时 ArrowDown 落到首项、ArrowUp 落到末项 */
function nextIndex(key: string, current: number, size: number): number | null {
  const last = size - 1;
  if (key === "ArrowDown") return current < 0 ? 0 : (current + 1) % size;
  if (key === "ArrowUp") return current <= 0 ? last : current - 1;
  if (key === "Home") return 0;
  if (key === "End") return last;
  return null;
}

/**
 * 菜单键盘导航：打开即把焦点移入面板，方向键 / Home / End 在项间漫游（循环），
 * Escape 关闭并回焦触发按钮，Tab 交回触发按钮后由用户继续 Tab。
 * role="menu" 声明了菜单语义，方向键漫游与焦点归还即是对应的必备行为。
 */
export function useMenuKeyboardNav({ panelRef, triggerRef, open, submenuKey, close, onBack }: UseMenuKeyboardNavOptions) {
  const previousSubmenu = useRef<string | null>(null);

  const focusItem = useCallback(
    (key: string | null) => {
      const items = menuItems(panelRef.current);
      const target = key ? items.find((item) => item.dataset.menuKey === key) : undefined;
      (target ?? items[0])?.focus();
    },
    [panelRef]
  );

  const restoreTriggerFocus = useCallback(() => {
    triggerRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, [triggerRef]);

  // 打开或切换子视图后把焦点移进面板；从子视图返回时回到打开它的那一项
  useEffect(() => {
    if (!open) {
      previousSubmenu.current = null;
      return;
    }
    const returning = submenuKey ? null : previousSubmenu.current;
    previousSubmenu.current = submenuKey;
    focusItem(returning);
  }, [open, submenuKey, focusItem]);

  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape") {
        // 子视图内先退回主列表（并阻断 useAnchoredLayer 的全局 Escape 关层）
        event.preventDefault();
        event.stopPropagation();
        if (submenuKey) onBack();
        else {
          close();
          restoreTriggerFocus();
        }
        return;
      }
      if (event.key === "Tab") {
        // 菜单是单一焦点域，不做 Tab 遍历：关闭后把焦点交回触发按钮
        event.preventDefault();
        close();
        restoreTriggerFocus();
        return;
      }
      const items = menuItems(panelRef.current);
      const target = nextIndex(event.key, items.indexOf(event.target as HTMLElement), items.length);
      if (target === null) return;
      event.preventDefault();
      items[target]?.focus();
    },
    [close, onBack, panelRef, restoreTriggerFocus, submenuKey]
  );
}
