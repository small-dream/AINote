import { getVersion } from "@tauri-apps/api/app";

/** GitHub Release 最新版本信息（移动端分发用；不经过 updater 插件）。 */
export interface ReleaseInfo {
  version: string;
  htmlUrl: string;
  body: string | null;
  currentVersion: string;
}

const RELEASE_API = "https://api.github.com/repos/small-dream/AINote/releases/latest";
const RELEASE_TAG_BASE = "https://github.com/small-dream/AINote/releases/tag";

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

  return {
    version,
    htmlUrl: stringField(payload, "html_url") ?? `${RELEASE_TAG_BASE}/v${version}`,
    body: stringField(payload, "body"),
    currentVersion,
  };
}

/** 读取对象的字符串字段；缺失或类型不符时返回 null（不信任接口结构）。 */
function stringField(payload: unknown, key: string): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const value: unknown = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export const releaseApi = { fetchLatestRelease };
