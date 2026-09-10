import { getVersion } from "@tauri-apps/api/app";

/** GitHub Release 最新版本信息（移动端分发用；不经过 updater 插件）。 */
export interface ReleaseInfo {
  version: string;
  htmlUrl: string;
  body: string | null;
  currentVersion: string;
  /** Android APK 资产下载地址；缺失（旧版本 Release）时降级为浏览器下载 */
  apkUrl: string | null;
  /** APK 对应的 .sha256 资产地址；与 apkUrl 同时存在才支持应用内更新 */
  apkSha256Url: string | null;
}

const RELEASE_API = "https://api.github.com/repos/small-dream/AINote/releases/latest";
const RELEASE_TAG_BASE = "https://github.com/small-dream/AINote/releases/tag";
const APK_ASSET_SUFFIX = "-android-arm64.apk";

/** 查询 GitHub Releases 最新正式版；网络或接口异常时抛错，由调用方静默降级。 */
async function fetchLatestRelease(): Promise<ReleaseInfo> {
  const [response, currentVersion] = await Promise.all([
    fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" } }),
    getVersion(),
  ]);
  if (!response.ok) throw new Error("RELEASE_FETCH_FAILED");

  const payload: unknown = await response.json();
  const tag = stringField(payload, "tag_name");
  if (!tag) throw new Error("RELEASE_PAYLOAD_INVALID");
  const version = tag.replace(/^[vV]/, "");
  const assets = assetUrls(payload);

  return {
    version,
    htmlUrl: stringField(payload, "html_url") ?? `${RELEASE_TAG_BASE}/v${version}`,
    body: stringField(payload, "body"),
    currentVersion,
    apkUrl: assets.apkUrl,
    apkSha256Url: assets.apkSha256Url,
  };
}

/** 从 assets 中定位 APK 与其校验和文件；不信任接口结构，逐项校验类型。 */
function assetUrls(payload: unknown): { apkUrl: string | null; apkSha256Url: string | null } {
  if (typeof payload !== "object" || payload === null) return { apkUrl: null, apkSha256Url: null };
  const assets: unknown = (payload as Record<string, unknown>).assets;
  if (!Array.isArray(assets)) return { apkUrl: null, apkSha256Url: null };

  const byName = new Map<string, string>();
  for (const asset of assets) {
    const name = stringField(asset, "name");
    const url = stringField(asset, "browser_download_url");
    if (name && url) byName.set(name, url);
  }

  const apkName = [...byName.keys()].find((name) => name.endsWith(APK_ASSET_SUFFIX)) ?? null;
  return {
    apkUrl: apkName ? byName.get(apkName) ?? null : null,
    apkSha256Url: apkName ? byName.get(`${apkName}.sha256`) ?? null : null,
  };
}

/** 读取对象的字符串字段；缺失或类型不符时返回 null（不信任接口结构）。 */
function stringField(payload: unknown, key: string): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const value: unknown = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export const releaseApi = { fetchLatestRelease };
