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

function listReleases(repo) {
  return gh([`repos/${repo}/releases?per_page=100`, "--paginate", "--jq", ".[] | {id, tag_name, name, draft}"])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function resolve(repo, tag, body) {
  const { release, orphaned } = selectRelease(listReleases(repo), tag);
  if (!release) {
    const created = JSON.parse(
      gh([
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
