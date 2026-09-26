import { useNoteReloadStore } from "@/stores/note-reload.store";

/**
 * 编辑器重载令牌：工作区纪元（同步 / 冲突解决 / 历史恢复）与面板纪元合并为一个递增令牌，
 * 外加「用户显式丢弃草稿」的强制令牌——后者无视脏草稿守卫，必须与普通重载分开传递。
 */
export function useNoteReloadTokens(reloadToken: number): {
  reloadToken: number;
  forceToken: number;
} {
  const workspaceEpoch = useNoteReloadStore((state) => state.epoch);
  const forcedEpoch = useNoteReloadStore((state) => state.forcedEpoch);
  return { reloadToken: reloadToken + workspaceEpoch, forceToken: forcedEpoch };
}
