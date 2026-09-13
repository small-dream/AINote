/* global process, console */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const TAG_PATTERN = /^v\d+\.\d+\.\d+$/;
const ORPHAN_TAG_PREFIX = "untagged-";

export function releaseName(tag) {
  return `AINote ${tag}`;
}

export function selectRelease(releases, tag) {
  const matching = releases.filter((release) => release.tag_name === tag);
  if (matching.length > 1) {
    throw new Error(`发现多个 tag 为 ${tag} 的 Release，请先手动清理草稿`);
  }
  if (matching.length === 1) {
    return { release: matching[0], orphaned: false };
  }

  const orphans = releases.filter(
    (release) =>
      release.draft === true &&
      release.name === releaseName(tag) &&
      typeof release.tag_name === "string" &&
      release.tag_name.startsWith(ORPHAN_TAG_PREFIX),
  );
  if (orphans.length > 1) {
    throw new Error(`发现多个孤立草稿（name=${releaseName(tag)}），请先手动清理草稿`);
  }
  return { release: orphans[0] ?? null, orphaned: orphans.length === 1 };
}

function gh(args) {
  return execFileSync("gh", ["api", ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

function listReleases(repo, run = gh) {
  return run([`repos/${repo}/releases?per_page=100`, "--paginate", "--jq", ".[] | {id, tag_name, name, draft}"])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/**
 * 创建草稿 Release。
 *
 * `gh api POST /releases` 曾出现「远端已创建成功、但响应体为空导致 gh 解析失败」的
 * 情况（v0.29.0 首次发布），此时若直接把错误抛出去，整条发布流水线会失败，而远端已经
 * 留下一份内容正确的草稿。因此创建失败后复核一次远端状态：只要草稿已存在就继续，
 * 由调用方按「复用草稿」的路径补齐正文。
 */
export function createRelease(repo, tag, body, run = gh) {
  try {
    const created = JSON.parse(
      run([
        "--method",
        "POST",
        `repos/${repo}/releases`,
        "-f",
        `tag_name=${tag}`,
        "-f",
        `name=${releaseName(tag)}`,
        "-f",
        `body=${body}`,
        "-F",
        "draft=true",
      ]),
    );
    return { id: created.id, bodyApplied: true };
  } catch (error) {
    const { release } = selectRelease(listReleases(repo, run), tag);
    if (!release) throw error;
    console.error(`::warning::创建草稿的响应不可解析，已复核到 Release ${release.id}（改用复用路径）`);
    return { id: release.id, bodyApplied: false };
  }
}

function resolve(repo, tag, body) {
  const { release, orphaned } = selectRelease(listReleases(repo), tag);
  if (!release) {
    const created = createRelease(repo, tag, body);
    // 兜底路径拿到的是列表数据（不含正文），补一次 PATCH 保证 Release Notes 完整。
    if (!created.bodyApplied) {
      gh(["--method", "PATCH", `repos/${repo}/releases/${created.id}`, "-f", `body=${body}`]);
    }
    return created.id;
  }

  const params = ["--method", "PATCH", `repos/${repo}/releases/${release.id}`, "-F", "draft=true", "-f", `body=${body}`];
  if (orphaned) {
    console.error(`::warning::孤立草稿 Release ${release.id}（tag_name=${release.tag_name}）已修复为 ${tag}`);
    params.push("-f", `tag_name=${tag}`);
  }
  gh(params);
  return release.id;
}

function main() {
  const tag = process.argv[2];
  const body = process.argv[3] ?? "";
  const repo = process.env.REPO;
  if (!TAG_PATTERN.test(tag ?? "")) {
    throw new Error(`版本标签必须是 vMAJOR.MINOR.PATCH，收到：${tag ?? "空"}`);
  }
  if (!repo) {
    throw new Error("缺少 REPO 环境变量");
  }
  process.stdout.write(String(resolve(repo, tag, body)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
