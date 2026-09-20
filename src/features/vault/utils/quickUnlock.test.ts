import { describe, expect, it } from "vitest";
import type { TranslationKey } from "@/i18n/messages";
import {
  DISABLED_QUICK_UNLOCK,
  quickUnlockKindLabel,
  quickUnlockOf,
  quickUnlockReasonText,
} from "./quickUnlock";

const t = (key: TranslationKey) => key;

describe("quickUnlockOf", () => {
  it("缺少字段时回退为不支持且未开启", () => {
    expect(quickUnlockOf(undefined)).toEqual(DISABLED_QUICK_UNLOCK);
    expect(quickUnlockOf({})).toEqual(DISABLED_QUICK_UNLOCK);
  });

  it("保留后端给出的支持能力与认证方式", () => {
    expect(quickUnlockOf({ quickUnlock: { supported: true, enabled: true, kind: "touchId" } })).toEqual({
      supported: true,
      enabled: true,
      kind: "touchId",
      reason: null,
    });
  });

  it("把非布尔值收敛为 false，避免出现假开启", () => {
    const loose = { quickUnlock: { supported: 1, enabled: "yes", kind: null } } as never;
    expect(quickUnlockOf(loose)).toEqual({
      supported: false,
      enabled: false,
      kind: null,
      reason: null,
    });
  });
});

describe("quickUnlockKindLabel", () => {
  it("按认证方式给出文案", () => {
    expect(quickUnlockKindLabel("faceId", t)).toBe("vault.deviceKindFaceId");
    expect(quickUnlockKindLabel("biometric", t)).toBe("vault.deviceKindBiometric");
  });

  it("未知或缺失时给通用文案", () => {
    expect(quickUnlockKindLabel(null, t)).toBe("vault.deviceKindDefault");
    expect(quickUnlockKindLabel(undefined, t)).toBe("vault.deviceKindDefault");
    expect(quickUnlockKindLabel("voiceprint" as never, t)).toBe("vault.deviceKindDefault");
  });
});

describe("quickUnlockReasonText", () => {
  it("原因码一一映射到可读文案", () => {
    expect(quickUnlockReasonText("noDeviceLock", t)).toBe("vault.unsupportedNoDeviceLock");
    expect(quickUnlockReasonText("noBiometric", t)).toBe("vault.unsupportedNoBiometric");
    expect(quickUnlockReasonText("platformUnsupported", t)).toBe("vault.unsupportedPlatform");
    expect(quickUnlockReasonText("deviceAuthUnavailable", t)).toBe(
      "vault.unsupportedDeviceAuthUnavailable"
    );
  });

  it("缺失或未知原因绝不返回空文案", () => {
    expect(quickUnlockReasonText(null, t)).toBe("vault.unsupportedProbeFailed");
    expect(quickUnlockReasonText(undefined, t)).toBe("vault.unsupportedProbeFailed");
    expect(quickUnlockReasonText("mystery" as never, t)).toBe("vault.unsupportedProbeFailed");
  });
});
