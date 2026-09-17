import { useTranslation } from "@/i18n";
import { useVaultStatusQuery, useNoteEncryptionMutation } from "@/queries/vault.queries";
import { reportToastError, useToastStore } from "@/stores/toast.store";
import { useUiStore } from "@/stores/ui.store";

/** 右键菜单共用的「逐篇加密/解密」菜单项描述。 */
export interface NoteEncryptionMenuAction {
  action: "encrypt" | "decrypt";
  pending: boolean;
  onSelect: () => void;
}

/**
 * 逐篇加密开关（E4）：仓库已建库即可展示入口（锁定/解锁均可用）。
 * - 解锁态：直接执行加密/解密。
 * - 锁定态：点击后直接弹出全局解锁输入框，解锁成功后自动执行目标动作。
 * 结果用 toast 反馈，因为切换后正文所在文件已经被改写，用户需要立即知道。
 */
export function useNoteEncryptionAction(repoPath: string | null) {
  const { t } = useTranslation();
  const status = useVaultStatusQuery(repoPath);
  const mutation = useNoteEncryptionMutation();
  const openVaultDialog = useUiStore((state) => state.openVaultDialog);
  const state = status.data?.state;
  /** 仓库已建库（未建库时不展示入口，避免点了必然失败） */
  const vaultReady = state === "locked" || state === "unlocked";

  const toggle = (path: string, encrypted: boolean) => {
    if (!vaultReady || mutation.isPending) return;
    const run = () => {
      const push = useToastStore.getState().push;
      mutation.mutate(
        { path, encrypted: !encrypted },
        {
          onSuccess: () => push(t(encrypted ? "note.decrypted" : "note.encrypted"), "success"),
          onError: reportToastError,
        },
      );
    };
    if (state === "locked") {
      openVaultDialog(run);
      return;
    }
    run();
  };

  return {
    /** 仓库已建库（锁定/解锁均展示入口） */
    vaultReady,
    pending: mutation.isPending,
    toggle,
  };
}

export function useNoteEncryption(repoPath: string | null, notePath: string | null, encrypted: boolean) {
  const { vaultReady, pending, toggle } = useNoteEncryptionAction(repoPath);
  return {
    /** 是否展示入口：仓库已建库且存在笔记路径 */
    available: vaultReady && notePath !== null,
    action: encrypted ? ("decrypt" as const) : ("encrypt" as const),
    pending,
    toggle: () => {
      if (notePath !== null) toggle(notePath, encrypted);
    },
  };
}
