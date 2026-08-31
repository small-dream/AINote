/* global process, console */
import fs from "node:fs";

const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  throw new Error(`版本标签必须是 vMAJOR.MINOR.PATCH，收到：${tag ?? "空"}`);
}

const version = tag.slice(1);
const packageVersion = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
const tauriVersion = JSON.parse(fs.readFileSync("src-tauri/tauri.conf.json", "utf8")).version;
const cargo = fs.readFileSync("src-tauri/Cargo.toml", "utf8");
const cargoVersion = cargo.match(/^version = "([^"]+)"/m)?.[1];
const versions = { package: packageVersion, tauri: tauriVersion, cargo: cargoVersion };
if (Object.values(versions).some((value) => value !== version)) {
  throw new Error(`版本不一致：${JSON.stringify(versions)}，期望 ${version}`);
}
console.log(`Release version ${version} verified`);
