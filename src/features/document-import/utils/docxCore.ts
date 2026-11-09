import mammoth from "mammoth";
import { MAX_IMAGE_BYTES } from "@/features/asset/utils/importFiles";
import {
  DOCUMENT_ASSET_PROTOCOL,
  MAX_DOCUMENT_IMAGES,
  MAX_TOTAL_IMAGE_BYTES,
  type DocumentAsset,
  type DocumentImportWarning,
} from "../types";

const STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Heading 5'] => h5:fresh",
  "p[style-name='Heading 6'] => h6:fresh",
  "r[style-name='Code Char'] => code",
];

export interface DocxConversion {
  html: string;
  assets: DocumentAsset[];
  warnings: DocumentImportWarning[];
}

function extensionOf(contentType: string): string {
  const value = contentType.toLocaleLowerCase();
  if (value.includes("jpeg") || value.includes("jpg")) return "jpg";
  if (value.includes("gif")) return "gif";
  if (value.includes("webp")) return "webp";
  if (value.includes("svg")) return "svg";
  if (value.includes("bmp")) return "bmp";
  return "png";
}

function decodeBase64(value: string): Uint8Array {
  const binary = globalThis.atob(value.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function convertDocxToHtml(arrayBuffer: ArrayBuffer): Promise<DocxConversion> {
  const assets: DocumentAsset[] = [];
  const warnings = new Set<DocumentImportWarning>();
  let totalBytes = 0;

  const convertImage = mammoth.images.imgElement(async (image) => {
    if (assets.length >= MAX_DOCUMENT_IMAGES) {
      warnings.add("imageLimit");
      return { src: "" };
    }
    try {
      const bytes = decodeBase64(await image.read("base64"));
      if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES || totalBytes + bytes.length > MAX_TOTAL_IMAGE_BYTES) {
        warnings.add("imageLimit");
        return { src: "" };
      }
      const index = assets.length;
      totalBytes += bytes.length;
      assets.push({ fileName: `image-${index + 1}.${extensionOf(image.contentType)}`, bytes });
      return { src: `${DOCUMENT_ASSET_PROTOCOL}${index}` };
    } catch {
      warnings.add("formatSimplified");
      return { src: "" };
    }
  });

  try {
    const result = await mammoth.convertToHtml({ arrayBuffer }, { styleMap: STYLE_MAP, convertImage });
    if (result.messages.length > 0) warnings.add("formatSimplified");
    return { html: result.value, assets, warnings: [...warnings] };
  } catch (error) {
    throw new Error("word document could not be parsed", { cause: error });
  }
}
