import { create } from "zustand";

/**
 * 设备级快速解锁的自动触发闸门（纯 UI 态，不落盘）。
 *
 * 目标：已开启快速解锁时，解锁界面一出现就自动弹系统认证，用户不必先点按钮；
 * 同时避免两种反向打扰：
 * - 用户刚点「立即锁定」→ 抑制自动触发，否则弹窗会把刚锁上的仓库立刻解开；
 * - 用户取消了系统认证 → 本次锁定周期内不再自动弹（按钮仍可重试）。
 */
interface VaultUnlockGate {
  /** 用户主动锁定后为 true：早于此状态出现的解锁界面不自动触发 */
  suppressed: boolean;
  /** 本次锁定周期内是否已经自动触发过 */
  spent: boolean;
  /** 允许一次自动触发：被动锁定（启动 / 切仓库 / 空闲自动锁定）与用户主动打开解锁入口 */
  arm: () => void;
  /** 用户主动锁定：抑制自动触发 */
  suppress: () => void;
  /** 取用一次自动触发机会；已抑制或已用过则返回 false */
  consumeAuto: () => boolean;
}

export const useVaultUnlockStore = create<VaultUnlockGate>((set, get) => ({
  suppressed: false,
  spent: false,
  arm: () => set({ suppressed: false, spent: false }),
  suppress: () => set({ suppressed: true, spent: true }),
  consumeAuto: () => {
    const { suppressed, spent } = get();
    if (suppressed || spent) return false;
    set({ spent: true });
    return true;
  },
}));
