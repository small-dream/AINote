import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vaultApi } from "@/api";
import type { NoteMeta, VaultStatusResponse } from "@/api/types";

/** 仓库加密状态：服务端态（唯一权威来源），不用 Zustand/useState 镜像。 */
export const vaultKeys = {
  status: (repoPath: string | null) => ["vault", repoPath] as const,
};

export function useVaultStatusQuery(repoPath: string | null) {
  return useQuery({
    queryKey: vaultKeys.status(repoPath),
    queryFn: vaultApi.status,
    enabled: repoPath !== null,
  });
}

/**
 * 解锁/锁定会改变「哪些笔记可读」，因此一次性失效内容、列表、搜索、wiki 与同步态；
 * 错误不做全局 toast，交给表单就地提示（口令错误属于用户输入问题）。
 */
function useVaultMutation<TInput>(mutationFn: (input: TInput) => Promise<VaultStatusResponse>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["vault"] });
      void queryClient.invalidateQueries({ queryKey: ["note-content"] });
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["wiki"] });
      void queryClient.invalidateQueries({ queryKey: ["search"] });
    },
  });
}

export function useVaultCreateMutation() {
  return useVaultMutation((passphrase: string) => vaultApi.create(passphrase));
}

export function useVaultUnlockMutation() {
  return useVaultMutation((passphrase: string) => vaultApi.unlock(passphrase));
}

export function useVaultLockMutation() {
  return useVaultMutation(() => vaultApi.lock());
}

export function useVaultChangePassphraseMutation() {
  return useVaultMutation(({ oldPassphrase, newPassphrase }: { oldPassphrase: string; newPassphrase: string }) =>
    vaultApi.changePassphrase(oldPassphrase, newPassphrase),
  );
}

/** 开启设备级快速解锁：会弹出系统认证，成功后本机可用设备认证免口令解锁。 */
export function useVaultQuickUnlockEnableMutation() {
  return useVaultMutation(() => vaultApi.enableQuickUnlock());
}

/** 关闭设备级快速解锁：删除本机条目，立即回到「每次输入口令」。 */
export function useVaultQuickUnlockDisableMutation() {
  return useVaultMutation(() => vaultApi.disableQuickUnlock());
}

/** 设备认证解锁：系统界面可能停留数秒，取消与失败分别由 VAULT_9007 / VAULT_9008 表达。 */
export function useVaultDeviceUnlockMutation() {
  return useVaultMutation(() => vaultApi.unlockWithDevice());
}

interface NoteEncryptionInput {
  path: string;
  encrypted: boolean;
}

/** 逐篇加密开关（E4）：同时影响正文、列表标题来源与提交内容，因此失效面最广。 */
export function useNoteEncryptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, encrypted }: NoteEncryptionInput) => vaultApi.setNoteEncryption(path, encrypted),
    onSuccess: (_meta: NoteMeta) => {
      for (const key of [["vault"], ["tree"], ["note-content"], ["notes"], ["wiki"], ["search"], ["sync"]]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
