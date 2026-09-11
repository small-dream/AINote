/* global process, console */
import { execFileSync, spawn } from "node:child_process";

// 统一 iOS 构建入口，对齐 scripts/tauri-android.mjs 的使用体验：
// 1) 确认运行在 macOS 且 Xcode 命令行工具可用；
// 2) 缺少 Rust 的 iOS target 时自动补装（模拟器 aarch64-apple-ios-sim / 真机 aarch64-apple-ios）；
// 3) 未指定设备时自动选一台模拟器（优先已启动的 iPhone，否则最新运行时的 iPhone），
//    省掉手查设备名与交互选择；
// 4) 其余参数原样透传给 `tauri ios`。
// 说明：iOS 侧不需要 Android 那样的 OPENSSL_SRC_PERL 与 NDK 注入；vendored OpenSSL 以及
// libgit2 的 zlib、iconv 链接已在 src-tauri/gen/apple/project.yml 配置好。

const IOS_TARGETS = ["aarch64-apple-ios-sim", "aarch64-apple-ios"];

function tryRun(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function ensureXcode() {
  const developerDir = tryRun("xcode-select", ["-p"]);
  if (!developerDir) {
    console.error("[ainote] 未检测到 Xcode：先执行 `xcode-select --install`，或安装完整 Xcode 后执行 `sudo xcode-select -s /Applications/Xcode.app`。");
    process.exit(1);
  }
  if (!tryRun("xcrun", ["simctl", "help"])) {
    console.error(`[ainote] ${developerDir} 下没有可用的 simctl，请完整安装 Xcode 并至少打开一次（命令行工具单独安装不含模拟器）。`);
    process.exit(1);
  }
  console.log(`[ainote] Xcode: ${developerDir}`);
}

function ensureRustTargets() {
  const installed = tryRun("rustup", ["target", "list", "--installed"]);
  if (installed === null) {
    console.warn(`[ainote] 未检测到 rustup，跳过 iOS target 检查；若编译报找不到 std，请手动执行：rustup target add ${IOS_TARGETS.join(" ")}`);
    return;
  }
  const have = new Set(installed.split("\n").map((line) => line.trim()));
  const missing = IOS_TARGETS.filter((target) => !have.has(target));
  if (missing.length === 0) {
    return;
  }
  console.log(`[ainote] 补装 Rust iOS target：${missing.join(" ")}`);
  try {
    execFileSync("rustup", ["target", "add", ...missing], { stdio: "inherit" });
  } catch {
    console.error(`[ainote] 自动补装失败，请手动执行：rustup target add ${missing.join(" ")}`);
    process.exit(1);
  }
}

function runtimeRank(runtime) {
  const match = runtime.match(/iOS-(\d+)(?:-(\d+))?/);
  return match ? [Number(match[1]), Number(match[2] ?? 0)] : [0, 0];
}

function availableSimulators() {
  const raw = tryRun("xcrun", ["simctl", "list", "devices", "available", "--json"]);
  if (!raw) {
    return [];
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  return Object.entries(parsed.devices ?? {})
    .sort(([a], [b]) => {
      const [aMajor, aMinor] = runtimeRank(a);
      const [bMajor, bMinor] = runtimeRank(b);
      return bMajor - aMajor || bMinor - aMinor;
    })
    .flatMap(([runtime, devices]) => devices.map((device) => ({ ...device, runtime })));
}

/** 优先已启动的 iPhone，其次任意已启动设备，最后取最新 iOS 运行时下的 iPhone。 */
function pickDevice(devices) {
  return (
    devices.find((device) => device.state === "Booted" && device.name.startsWith("iPhone")) ??
    devices.find((device) => device.state === "Booted") ??
    devices.find((device) => device.name.startsWith("iPhone")) ??
    devices[0] ??
    null
  );
}

function withDevice(args) {
  if (args.includes("--help") || args.includes("-h")) {
    return args;
  }
  const first = args[0];
  if (first && !first.startsWith("-")) {
    return args;
  }
  const device = pickDevice(availableSimulators());
  if (!device) {
    console.warn("[ainote] 未找到可用模拟器：请在 Xcode → Settings → Components 安装 iOS 运行时后重试。");
    return args;
  }
  const state = device.state === "Booted" ? "已启动" : "未启动，Tauri 会自动启动";
  console.log(`[ainote] 使用模拟器：${device.name}（${state}）`);
  console.log(`[ainote] 换设备：pnpm ios:dev "iPhone Air"；设备名放在最前面。可选列表：xcrun simctl list devices available`);
  return [device.name, ...args];
}

function main() {
  if (process.platform !== "darwin") {
    console.error("[ainote] iOS 只能在 macOS 上构建：需要 Xcode 与 iOS 模拟器，请在 macOS 或 CI 的 macOS runner 上执行。");
    process.exit(1);
  }

  // package.json 里的 ios:dev 传入的是子命令（dev / build / init…），设备名与选项排在它后面。
  const [subcommand = "dev", ...args] = process.argv.slice(2);
  if (!args.includes("--help") && !args.includes("-h")) {
    ensureXcode();
    ensureRustTargets();
  }

  const child = spawn("pnpm", ["exec", "tauri", "ios", subcommand, ...withDevice(args)], { stdio: "inherit" });
  child.on("error", (error) => {
    console.error(`[ainote] 启动 tauri 失败: ${error.message}`);
    process.exit(1);
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

main();
