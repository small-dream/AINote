import {
  useVaultChangePassphraseMutation,
  useVaultCreateMutation,
  useVaultDeviceUnlockMutation,
  useVaultLockMutation,
  useVaultQuickUnlockDisableMutation,
  useVaultQuickUnlockEnableMutation,
  useVaultStatusQuery,
  useVaultUnlockMutation,
} from "@/queries/vault.queries";
import { useSessionStore } from "@/stores/session.store";
import { repoNameOf } from "../utils/repoName";

/**
 * 设置页「加密笔记」编排：仓库状态走 Query（服务端态），口令只经 mutation 透传给 Rust。
 * 前端不缓存口令、不保存密钥，也不做「记住口令」（决策 ⑤）。
 */
export function useVaultSettings() {
  const repoPath = useSessionStore((state) => state.repoPath);
  return {
    repoPath,
    repoContext: [repoNameOf(repoPath)],
    status: useVaultStatusQuery(repoPath),
    create: useVaultCreateMutation(),
    unlock: useVaultUnlockMutation(),
    lock: useVaultLockMutation(),
    changePassphrase: useVaultChangePassphraseMutation(),
    enableQuickUnlock: useVaultQuickUnlockEnableMutation(),
    disableQuickUnlock: useVaultQuickUnlockDisableMutation(),
    unlockWithDevice: useVaultDeviceUnlockMutation(),
  };
}
