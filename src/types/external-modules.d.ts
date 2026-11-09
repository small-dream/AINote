declare module "mammoth" {
  export interface MammothImage {
    contentType: string;
    read(encoding: "base64"): Promise<string>;
  }

  export interface MammothMessage {
    type: string;
    message: string;
  }

  export interface MammothResult {
    value: string;
    messages: MammothMessage[];
  }

  export interface MammothOptions {
    styleMap?: string[];
    convertImage?: unknown;
    includeDefaultStyleMap?: boolean;
  }

  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer },
    options?: MammothOptions,
  ): Promise<MammothResult>;

  export const images: {
    imgElement(
      convert: (image: MammothImage) => Promise<{ src: string }> | { src: string },
    ): unknown;
  };
}

declare module "@joplin/turndown-plugin-gfm" {
  import type TurndownService from "turndown";

  export const gfm: TurndownService.Plugin;
}

declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export * from "pdfjs-dist";
}
