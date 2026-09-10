/** 语义化版本比较（移动端更新提示用；纯函数，无平台依赖）。 */

export interface ParsedVersion {
  core: number[];
  prerelease: string[];
}

/**
 * 解析版本号：容忍 `v` 前缀与构建元数据（`+build`），预发布段按 `-` 之后原样保留。
 * 无法解析（空串、非数字主版本）时返回 null，由调用方决定降级策略。
 */
export function parseVersion(raw: string): ParsedVersion | null {
  const trimmed = raw.trim().replace(/^[vV]/, "");
  if (!trimmed) return null;

  const buildIndex = trimmed.indexOf("+");
  const withoutBuild = buildIndex >= 0 ? trimmed.slice(0, buildIndex) : trimmed;
  const prereleaseIndex = withoutBuild.indexOf("-");
  const coreText = prereleaseIndex >= 0 ? withoutBuild.slice(0, prereleaseIndex) : withoutBuild;
  const prereleaseText = prereleaseIndex >= 0 ? withoutBuild.slice(prereleaseIndex + 1) : "";
  const segments = coreText.split(".");
  if (segments.some((segment) => !/^\d+$/.test(segment))) return null;

  return { core: segments.map(Number), prerelease: prereleaseText ? prereleaseText.split(".") : [] };
}

/** 比较两个版本：前者新返回 1、相同返回 0、后者新返回 -1；任一无法解析返回 null。 */
export function compareVersions(left: string, right: string): number | null {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;

  const length = Math.max(a.core.length, b.core.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (a.core[index] ?? 0) - (b.core[index] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }

  if (a.prerelease.length === 0) return b.prerelease.length === 0 ? 0 : 1;
  if (b.prerelease.length === 0) return -1;
  return comparePrerelease(a.prerelease, b.prerelease);
}

/**
 * 候选版本是否严格新于当前版本。
 * 无法解析时返回 false——宁可漏报也不误报（降级保护）。
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) === 1;
}

/** 预发布段比较：数字标识符按数值、字母按字典序，数字小于字母（semver 规则）。 */
function comparePrerelease(a: string[], b: string[]): number {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (left === undefined) return -1;
    if (right === undefined) return 1;

    const leftNumber = numericIdentifier(left);
    const rightNumber = numericIdentifier(right);
    if (leftNumber !== null && rightNumber !== null) {
      if (leftNumber !== rightNumber) return leftNumber > rightNumber ? 1 : -1;
      continue;
    }
    if (leftNumber !== null) return -1;
    if (rightNumber !== null) return 1;
    if (left !== right) return left > right ? 1 : -1;
  }
  return 0;
}

function numericIdentifier(value: string): number | null {
  return /^\d+$/.test(value) ? Number(value) : null;
}
