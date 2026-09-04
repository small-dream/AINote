import { assetUrl } from "@/api";
import { resolveLocalAssetPath } from "@/features/asset/utils/asset";

/** 将仓库相对图片路径转换为 webview URL；无法转换时保留原始地址。 */
export function resolveImageSrc(repoPath: string | null, src: string): string {
  const local = resolveLocalAssetPath(repoPath ?? "", src);
  if (!local) return src;
  try {
    return assetUrl(local);
  } catch {
    return src;
  }
}
