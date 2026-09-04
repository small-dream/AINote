import { useMemo } from "react";
import { useAssetExistsQuery } from "@/queries/asset.queries";
import {
  diagnoseMarkdown,
  findImageRefs,
  type DiagnosticIssue,
} from "../utils/diagnostics";

/** 合并异步断链图片结果：先返回同步诊断，asset_exists 返回后再补图片缺失项。 */
export function useMarkdownDiagnostics(repoPath: string | null, content: string): DiagnosticIssue[] {
  const syncIssues = useMemo(() => diagnoseMarkdown(content), [content]);
  const imageRefs = useMemo(() => findImageRefs(content), [content]);
  const localPaths = useMemo(
    () => imageRefs.filter((ref) => ref.local).map((ref) => ref.src),
    [imageRefs]
  );
  const existsQuery = useAssetExistsQuery(repoPath, localPaths);
  const exists = useMemo(() => {
    const map = new Map<string, boolean>();
    const data = existsQuery.data ?? [];
    localPaths.forEach((path, index) => {
      const value = data[index];
      if (value !== undefined) map.set(path, value);
    });
    return map;
  }, [existsQuery.data, localPaths]);

  return useMemo(() => {
    if (localPaths.length > 0 && !existsQuery.isFetched) return syncIssues;
    const broken = imageRefs.flatMap((ref): DiagnosticIssue[] => {
      if (!ref.local || exists.get(ref.src) !== false) return [];
      return [{
        code: "DIAG_IMAGE_2",
        severity: "warning",
        source: "image",
        line: ref.line,
        message: `图片不存在：${ref.src}`,
      }];
    });
    return [...syncIssues, ...broken];
  }, [syncIssues, imageRefs, localPaths.length, existsQuery.isFetched, exists]);
}
