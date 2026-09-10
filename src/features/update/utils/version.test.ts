import { describe, expect, it } from "vitest";
import { compareVersions, isNewerVersion, parseVersion } from "./version";

describe("parseVersion", () => {
  it("解析主版本并按需补位", () => {
    expect(parseVersion("1.2.3")?.core).toEqual([1, 2, 3]);
    expect(parseVersion("v1.2")?.core).toEqual([1, 2]);
    expect(parseVersion(" 1.2.3 ")?.core).toEqual([1, 2, 3]);
  });

  it("保留预发布段并忽略构建元数据", () => {
    expect(parseVersion("1.2.3-beta.1")?.prerelease).toEqual(["beta", "1"]);
    expect(parseVersion("1.2.3-beta-2")?.prerelease).toEqual(["beta-2"]);
    expect(parseVersion("1.2.3+build.5")?.prerelease).toEqual([]);
  });

  it("无法解析的输入返回 null", () => {
    expect(parseVersion("")).toBeNull();
    expect(parseVersion("latest")).toBeNull();
    expect(parseVersion("1.x.3")).toBeNull();
  });
});

describe("compareVersions", () => {
  it("逐段按数值比较（1.2.3 < 1.2.10）", () => {
    expect(compareVersions("1.2.3", "1.2.10")).toBe(-1);
    expect(compareVersions("1.2.10", "1.2.3")).toBe(1);
  });

  it("段数不同时缺失段补 0", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("1.2.1", "1.2")).toBe(1);
  });

  it("主版本优先于次版本", () => {
    expect(compareVersions("2.0.0", "1.99.99")).toBe(1);
  });

  it("正式版高于同号预发布版", () => {
    expect(compareVersions("1.0.0", "1.0.0-beta.1")).toBe(1);
    expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBe(-1);
    expect(compareVersions("1.0.0-beta.2", "1.0.0-beta.10")).toBe(-1);
  });

  it("忽略 v 前缀与构建元数据", () => {
    expect(compareVersions("v0.25.0", "0.25.0")).toBe(0);
    expect(compareVersions("1.0.0+1", "1.0.0+2")).toBe(0);
  });

  it("任一无法解析时返回 null", () => {
    expect(compareVersions("1.0.0", "nightly")).toBeNull();
    expect(compareVersions("nightly", "1.0.0")).toBeNull();
  });
});

describe("isNewerVersion", () => {
  it("候选版本更新时为真", () => {
    expect(isNewerVersion("0.25.0", "0.24.12")).toBe(true);
    expect(isNewerVersion("1.2.10", "1.2.3")).toBe(true);
  });

  it("同一版本不误报", () => {
    expect(isNewerVersion("0.24.12", "0.24.12")).toBe(false);
    expect(isNewerVersion("v0.24.12", "0.24.12")).toBe(false);
  });

  it("降级（候选更旧）不提示", () => {
    expect(isNewerVersion("0.24.11", "0.24.12")).toBe(false);
    expect(isNewerVersion("0.24.12", "0.25.0")).toBe(false);
  });

  it("当前版本是预发布而候选是正式版时提示", () => {
    expect(isNewerVersion("0.25.0", "0.25.0-beta.1")).toBe(true);
  });

  it("无法解析时一律不提示（宁可漏报不误报）", () => {
    expect(isNewerVersion("nightly", "0.24.12")).toBe(false);
    expect(isNewerVersion("0.25.0", "unknown")).toBe(false);
    expect(isNewerVersion("", "")).toBe(false);
  });
});
