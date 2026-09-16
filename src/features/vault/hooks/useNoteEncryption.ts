import { useTranslation } from "@/i18n";
import { useVaultStatusQuery, useNoteEncryptionMutation } from "@/queries/vault.queries";
import { reportToastError, useToastStore } from "@/stores/toast.store";

/**
 * 逐篇加密开关（E4）：只有仓库处于解锁态才可用（加密/解密都需要主密钥）。
 * 结果用 toast 反馈，因为切换后正文所在文件已经被改写，用户需要立即知道。
 */
export function useNoteEncryption(repoPath: string | null, notePath: string | null, encrypted: boolean) {
  const { t } = useTranslation();
  const status = useVaultStatusQuery(repoPath);
  const mutation = useNoteEncryptionMutation();
  const available = status.data?.state === "unlocked" && notePath !== null;

  const toggle = () => {
    if (!available || notePath === null || mutation.isPending) return;
    const push = useToastStore.getState().push;
    mutation.mutate(
      { path: notePath, encrypted: !encrypted },
      {
        onSuccess: () => push(t(encrypted ? "note.decrypted" : "note.encrypted"), "success"),
        onError: reportToastError,
      },
    );
  };

  return {
    /** 是否展示入口：未建库或锁定时不展示（避免点了必然失败） */
    available,
    action: encrypted ? ("decrypt" as const) : ("encrypt" as const),
    pending: mutation.isPending,
    toggle,
  };
}
