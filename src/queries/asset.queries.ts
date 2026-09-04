import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assetApi, syncApi } from "@/api";
import type { AssetInfo } from "@/api/types";
import { reportToastError } from "@/stores/toast.store";

/** 资产导入成功后的统一副作用：提交版本化 + 刷新笔记/树/同步状态 */
function invalidateAfterAsset(queryClient: ReturnType<typeof useQueryClient>, path: string) {
  void queryClient.invalidateQueries({ queryKey: ["notes"] });
  void queryClient.invalidateQueries({ queryKey: ["tree"] });
  void syncApi.commit(`note: asset ${path}`).catch(reportToastError).finally(() => {
    void queryClient.invalidateQueries({ queryKey: ["sync"] });
  });
}

/** 从本地路径导入资产（拖放文件），成功即提交版本化（P1-4） */
export function useImportAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourcePath: string) => assetApi.importFromPath(sourcePath),
    onSuccess: (asset) => invalidateAfterAsset(queryClient, asset.path),
  });
}

/** 从内存字节导入资产（工具栏文件选择器），成功即提交版本化（P1-4） */
export function useImportAssetBytesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bytes, fileName }: { bytes: Uint8Array; fileName: string }) =>
      assetApi.importBytes(bytes, fileName),
    onSuccess: (asset) => invalidateAfterAsset(queryClient, asset.path),
  });
}

export type { AssetInfo };

/** 批量资产存在性检查（Markdown 图片断链诊断）；data 与 paths 顺序一致。 */
export function useAssetExistsQuery(repoPath: string | null, paths: string[]) {
  return useQuery({
    queryKey: ["asset-exists", repoPath, paths],
    queryFn: () => assetApi.exists(paths),
    enabled: repoPath !== null && paths.length > 0,
    staleTime: 10_000,
  });
}
