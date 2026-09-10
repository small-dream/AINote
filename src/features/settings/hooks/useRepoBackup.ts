import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { repoApi, type BackupProgress } from "@/api";

/** 整库备份：用户主动触发，进度经 Tauri Channel 回传，可中途取消。 */
export function useRepoBackup() {
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const mutation = useMutation({
    mutationFn: (excludeAssets: boolean) => repoApi.exportBackup(excludeAssets, setProgress),
    onSettled: () => setProgress(null),
  });

  const cancel = useCallback(() => {
    void repoApi.cancelBackup();
  }, []);

  return {
    result: mutation.data,
    pending: mutation.isPending,
    failed: mutation.isError,
    progress,
    run: mutation.mutate,
    cancel,
  };
}
