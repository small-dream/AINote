import { describe, expect, it } from "vitest";
import { voiceTextContent } from "./voiceText";

describe("voiceTextContent", () => {
  it("keeps markup-like speech as text", () => {
    expect(voiceTextContent("<b>重点</b> & <img src=x>")).toEqual([
      { type: "text", text: "<b>重点</b> & <img src=x>" },
    ]);
  });

  it("maps line breaks to hard breaks", () => {
    expect(voiceTextContent("第一行\n第二行")).toEqual([
      { type: "text", text: "第一行" },
      { type: "hardBreak" },
      { type: "text", text: "第二行" },
    ]);
  });

  it("returns no nodes for empty recognition", () => {
    expect(voiceTextContent("")).toEqual([]);
  });
});
