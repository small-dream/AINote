import { describe, expect, it } from "vitest";
import { assetIndexesIn, filterUsedAssets } from "./convert";
import { DocumentImportError, type DocumentAsset } from "../types";

function asset(name: string): DocumentAsset {
  return { fileName: name, bytes: new Uint8Array([1]) };
}

describe("assetIndexesIn", () => {
  it("提取所有图片占位符索引并去重", () => {
    const markdown = "![a](ainote-asset://0) ![b](ainote-asset://2) ![c](ainote-asset://0)";
    expect([...assetIndexesIn(markdown)]).toEqual([0, 2]);
  });
});

describe("filterUsedAssets", () => {
  it("只保留实际引用的图片并压缩索引", () => {
    const assets = [asset("a.png"), asset("b.png"), asset("c.png")];
    const result = filterUsedAssets("前 ![x](ainote-asset://2) 后 ![y](ainote-asset://2)", assets);
    expect(result.markdown).toBe("前 ![x](ainote-asset://0) 后 ![y](ainote-asset://0)");
    expect(result.assets.map((entry) => entry.fileName)).toEqual(["c.png"]);
  });

  it("保留稀疏引用的顺序并重排为连续索引", () => {
    const assets = [asset("a.png"), asset("b.png"), asset("c.png")];
    const result = filterUsedAssets("![b](ainote-asset://1) ![c](ainote-asset://2)", assets);
    expect(result.markdown).toBe("![b](ainote-asset://0) ![c](ainote-asset://1)");
    expect(result.assets.map((entry) => entry.fileName)).toEqual(["b.png", "c.png"]);
  });

  it("没有引用图片时返回空资产列表", () => {
    const result = filterUsedAssets("纯文本", [asset("a.png")]);
    expect(result.assets).toEqual([]);
    expect(result.markdown).toBe("纯文本");
  });

  it("引用不存在的图片索引时拒绝导入", () => {
    expect(() => filterUsedAssets("![x](ainote-asset://3)", [asset("a.png")])).toThrow(DocumentImportError);
    try {
      filterUsedAssets("![x](ainote-asset://3)", [asset("a.png")]);
    } catch (error) {
      expect((error as DocumentImportError).code).toBe("parseFailed");
    }
  });
});
