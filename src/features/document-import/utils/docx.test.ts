import { describe, expect, it } from "vitest";
import { detectOleWordProblem } from "./docx";

function bufferWith(bytes: number[], markers: string[] = []): ArrayBuffer {
  const markerBytes = markers.flatMap((marker) => [...marker].flatMap((char) => [char.charCodeAt(0), 0]));
  return new Uint8Array([...bytes, ...markerBytes, 0, 0]).buffer;
}

const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

describe("detectOleWordProblem", () => {
  it("普通 DOCX（ZIP 头）不触发", () => {
    expect(detectOleWordProblem(bufferWith([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
  });

  it("OLE 容器中的加密目录项判定为密码保护", () => {
    expect(detectOleWordProblem(bufferWith(OLE, ["EncryptedPackage"]))).toBe("passwordProtected");
    expect(detectOleWordProblem(bufferWith(OLE, ["EncryptionInfo"]))).toBe("passwordProtected");
  });

  it("旧版 OLE Word 判定为不支持", () => {
    expect(detectOleWordProblem(bufferWith(OLE, ["WordDocument"]))).toBe("unsupported");
  });
});
