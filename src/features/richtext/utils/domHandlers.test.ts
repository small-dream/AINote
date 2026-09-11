import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRichTextDomListeners, isModK } from "./domHandlers";

function imageFile(name = "pasted.png", size = 3): File {
  return new File([new Uint8Array(size)], name, { type: "image/png" });
}

function pasteEvent(files: File[]): Event {
  const event = new Event("paste", { cancelable: true, bubbles: true });
  Object.defineProperty(event, "clipboardData", { value: { files } });
  return event;
}

function dropEvent(files: File[]): Event {
  const event = new Event("drop", { cancelable: true, bubbles: true });
  Object.defineProperty(event, "dataTransfer", { value: { files } });
  return event;
}

describe("createRichTextDomListeners 粘贴/拖放", () => {
  let editorDom: HTMLElement;
  let outside: HTMLElement;

  beforeEach(() => {
    editorDom = document.createElement("div");
    outside = document.createElement("input");
    document.body.append(editorDom, outside);
  });

  it("编辑器区域内粘贴图片：拦截默认行为并进入导入管线", () => {
    const onFiles = vi.fn();
    const listeners = createRichTextDomListeners(editorDom, { onFiles, onRequestLink: vi.fn() });
    const event = pasteEvent([imageFile()]);

    editorDom.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onFiles).toHaveBeenCalledWith([imageFile()]);
    listeners.dispose();
  });

  it("编辑器区域外的粘贴不拦截", () => {
    const onFiles = vi.fn();
    const listeners = createRichTextDomListeners(editorDom, { onFiles, onRequestLink: vi.fn() });
    const event = pasteEvent([imageFile()]);

    outside.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(onFiles).not.toHaveBeenCalled();
    listeners.dispose();
  });

  it("纯文本粘贴与拖放非图片文件时不拦截", () => {
    const onFiles = vi.fn();
    const listeners = createRichTextDomListeners(editorDom, { onFiles, onRequestLink: vi.fn() });
    const plainPaste = pasteEvent([]);
    const txtDrop = dropEvent([new File(["x"], "notes.txt", { type: "text/plain" })]);

    editorDom.dispatchEvent(plainPaste);
    editorDom.dispatchEvent(txtDrop);

    expect(plainPaste.defaultPrevented).toBe(false);
    expect(txtDrop.defaultPrevented).toBe(false);
    expect(onFiles).not.toHaveBeenCalled();
    listeners.dispose();
  });

  it("区域内拖放图片进入导入管线", () => {
    const onFiles = vi.fn();
    const listeners = createRichTextDomListeners(editorDom, { onFiles, onRequestLink: vi.fn() });
    const event = dropEvent([imageFile("drop.png")]);

    editorDom.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onFiles).toHaveBeenCalledWith([imageFile("drop.png")]);
    listeners.dispose();
  });
});

describe("createRichTextDomListeners Mod-k 键位优先级", () => {
  let editorDom: HTMLElement;
  let outside: HTMLElement;

  beforeEach(() => {
    editorDom = document.createElement("div");
    outside = document.createElement("input");
    document.body.append(editorDom, outside);
  });

  it("编辑器内 Mod-k：打开链接输入并阻断冒泡到全局命令面板", () => {
    const onRequestLink = vi.fn();
    const listeners = createRichTextDomListeners(editorDom, { onFiles: vi.fn(), onRequestLink });
    const event = new KeyboardEvent("keydown", { key: "k", metaKey: true, cancelable: true, bubbles: true });

    editorDom.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onRequestLink).toHaveBeenCalledTimes(1);
    listeners.dispose();
  });

  it("编辑器外 Mod-k 与普通按键不拦截", () => {
    const onRequestLink = vi.fn();
    const listeners = createRichTextDomListeners(editorDom, { onFiles: vi.fn(), onRequestLink });
    const outsideEvent = new KeyboardEvent("keydown", { key: "k", metaKey: true, cancelable: true, bubbles: true });
    const plainKey = new KeyboardEvent("keydown", { key: "k", cancelable: true, bubbles: true });

    outside.dispatchEvent(outsideEvent);
    editorDom.dispatchEvent(plainKey);

    expect(outsideEvent.defaultPrevented).toBe(false);
    expect(plainKey.defaultPrevented).toBe(false);
    expect(onRequestLink).not.toHaveBeenCalled();
    listeners.dispose();
  });

  it("Ctrl-k 等效 Mod-k", () => {
    expect(isModK({ metaKey: false, ctrlKey: true, key: "k" })).toBe(true);
    expect(isModK({ metaKey: true, ctrlKey: false, key: "K" })).toBe(true);
    expect(isModK({ metaKey: false, ctrlKey: false, key: "k" })).toBe(false);
  });
});
