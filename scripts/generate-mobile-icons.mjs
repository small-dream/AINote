/* global Buffer, console */
// 生成与桌面端视觉一致的移动端应用图标（Android / iOS）。
// 桌面端图标是唯一基准：品牌蓝 #3F6FE5 圆角方底 + 白色几何 N（几何取自 src-tauri/icons/icon.svg）。
// 用法：node scripts/generate-mobile-icons.mjs
// 输出：src-tauri/icons/{android,ios}（图标源）与 src-tauri/gen/{android,apple}（实际构建资源）。
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BLUE = [63, 111, 229];
const WHITE = [255, 255, 255];

// --- 桌面 icon.svg 的几何（1024 坐标系） ---
const CANVAS = 1024;
const RECT = { x0: 24, y0: 24, x1: 1000, y1: 1000, r: 232 };
const STROKE = 150;
const SEGMENTS = [
  [[336, 324], [336, 700]],
  [[688, 324], [688, 700]],
  [[336, 324], [688, 700]],
];
const N_WIDTH = 502;
const N_CX = 512;
const N_CY = 512;
const BLUE_SQUARE = RECT.x1 - RECT.x0;
// 自适应图标可见区域为 108dp 前景层中央的 72dp 安全区。
const SAFE_ZONE = 72 / 108;
const N_TO_SQUARE = N_WIDTH / BLUE_SQUARE;
const FG_N_RATIO = N_TO_SQUARE * SAFE_ZONE;
const SS = 4;

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function inRoundedRect(x, y, size) {
  const k = size / CANVAS;
  const cx = ((RECT.x0 + RECT.x1) / 2) * k;
  const cy = ((RECT.y0 + RECT.y1) / 2) * k;
  const hw = ((RECT.x1 - RECT.x0) / 2) * k;
  const hh = ((RECT.y1 - RECT.y0) / 2) * k;
  const r = RECT.r * k;
  const qx = Math.max(Math.abs(x - cx) - (hw - r), 0);
  const qy = Math.max(Math.abs(y - cy) - (hh - r), 0);
  return Math.hypot(qx, qy) <= r;
}

function inCircle(x, y, size) {
  const r = size / 2;
  return Math.hypot(x - r, y - r) <= r;
}

function inN(x, y, size, scale) {
  const radius = (STROKE * scale) / 2;
  for (const [a, b] of SEGMENTS) {
    const ax = (a[0] - N_CX) * scale + size / 2;
    const ay = (a[1] - N_CY) * scale + size / 2;
    const bx = (b[0] - N_CX) * scale + size / 2;
    const by = (b[1] - N_CY) * scale + size / 2;
    if (distanceToSegment(x, y, ax, ay, bx, by) <= radius) {
      return true;
    }
  }
  return false;
}

function render(size, kind) {
  const scale = kind === "fg" ? (FG_N_RATIO * size) / N_WIDTH : size / CANVAS;
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          let color = null;
          if (inN(x, y, size, scale)) {
            color = WHITE;
          } else if (kind === "fg") {
            color = null;
          } else if (kind === "full" || (kind === "square" && inRoundedRect(x, y, size)) || (kind === "round" && inCircle(x, y, size))) {
            color = BLUE;
          }
          if (color) {
            r += color[0];
            g += color[1];
            b += color[2];
            a += 255;
          }
        }
      }
      const i = (py * size + px) * 4;
      if (a > 0) {
        rgba[i] = Math.round(r / (a / 255));
        rgba[i + 1] = Math.round(g / (a / 255));
        rgba[i + 2] = Math.round(b / (a / 255));
      }
      rgba[i + 3] = Math.round(a / (SS * SS));
    }
  }
  return rgba;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(size, rgba) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function writePng(path, size, kind) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(size, render(size, kind)));
}

const DENSITIES = [["mdpi", 1], ["hdpi", 1.5], ["xhdpi", 2], ["xxhdpi", 3], ["xxxhdpi", 4]];
const IOS_ICONS = [
  ["AppIcon-20x20@1x.png", 20], ["AppIcon-20x20@2x.png", 40], ["AppIcon-20x20@2x-1.png", 40], ["AppIcon-20x20@3x.png", 60],
  ["AppIcon-29x29@1x.png", 29], ["AppIcon-29x29@2x.png", 58], ["AppIcon-29x29@2x-1.png", 58], ["AppIcon-29x29@3x.png", 87],
  ["AppIcon-40x40@1x.png", 40], ["AppIcon-40x40@2x.png", 80], ["AppIcon-40x40@2x-1.png", 80], ["AppIcon-40x40@3x.png", 120],
  ["AppIcon-60x60@2x.png", 120], ["AppIcon-60x60@3x.png", 180], ["AppIcon-76x76@1x.png", 76], ["AppIcon-76x76@2x.png", 152],
  ["AppIcon-83.5x83.5@2x.png", 167], ["AppIcon-512@2x.png", 1024],
];
const ADAPTIVE_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
  <background android:drawable="@color/ic_launcher_background"/>
</adaptive-icon>
`;
const BACKGROUND_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="ic_launcher_background">#3F6FE5</color>
</resources>
`;

function writeAndroid(baseDir) {
  for (const [density, multiplier] of DENSITIES) {
    const legacy = Math.round(48 * multiplier);
    const foreground = Math.round(108 * multiplier);
    const dir = join(baseDir, `mipmap-${density}`);
    writePng(join(dir, "ic_launcher.png"), legacy, "square");
    writePng(join(dir, "ic_launcher_round.png"), legacy, "round");
    writePng(join(dir, "ic_launcher_foreground.png"), foreground, "fg");
  }
  mkdirSync(join(baseDir, "mipmap-anydpi-v26"), { recursive: true });
  writeFileSync(join(baseDir, "mipmap-anydpi-v26", "ic_launcher.xml"), ADAPTIVE_XML);
  writeFileSync(join(baseDir, "mipmap-anydpi-v26", "ic_launcher_round.xml"), ADAPTIVE_XML);
  mkdirSync(join(baseDir, "values"), { recursive: true });
  writeFileSync(join(baseDir, "values", "ic_launcher_background.xml"), BACKGROUND_XML);
}

function writeIos(baseDir) {
  for (const [name, size] of IOS_ICONS) {
    writePng(join(baseDir, name), size, "full");
  }
}

writeAndroid(join(ROOT, "src-tauri", "icons", "android"));
writeAndroid(join(ROOT, "src-tauri", "gen", "android", "app", "src", "main", "res"));
writeIos(join(ROOT, "src-tauri", "icons", "ios"));
writeIos(join(ROOT, "src-tauri", "gen", "apple", "Assets.xcassets", "AppIcon.appiconset"));
console.log("已生成与桌面端一致的 Android / iOS 应用图标。");
