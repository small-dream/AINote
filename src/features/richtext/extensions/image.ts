import { mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { assetUrl } from "@/api";
import { resolveLocalAssetPath } from "@/features/asset/utils/asset";

interface RichImageOptions {
  repoPath: string | null;
}

/** 仓库图片 node：src 存仓库相对路径（assets/xxx.png，跨设备可移植），
 * 渲染时按当前仓库路径解析为 webview 可访问 URL。 */
export const AinoteImage = Image.extend<RichImageOptions>({
  addOptions() {
    return { ...this.parent?.(), repoPath: null as string | null };
  },
  renderHTML({ HTMLAttributes }) {
    const { repoPath } = this.options;
    let src = HTMLAttributes.src as string;
    if (repoPath) {
      const local = resolveLocalAssetPath(repoPath, src);
      if (local) src = assetUrl(local);
    }
    return ["img", mergeAttributes(HTMLAttributes, { src })];
  },
});
