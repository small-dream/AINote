/* global process, console */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 统一 Android 构建入口：注入 OPENSSL_SRC_PERL 让 vendored OpenSSL 保留文件读取能力，
// 并补齐 NDK 的 RANLIB/AR，避免 openssl-src 使用 PATH 中不存在的 `*-ranlib`。
// 说明见 src-tauri/src/repositories/ca_bundle.rs 与 src-tauri/build.rs。
const here = path.dirname(fileURLToPath(import.meta.url));

// Tauri CLI 在 JAVA_HOME 未设置时会强制使用 Android Studio 自带的 JBR；
// 当前固定版本矩阵（Gradle 8.14 / AGP 8.11 / Kotlin 1.9）只支持 JDK 17-21，
// 若拿到 JBR 25 会在配置阶段直接失败。这里显式挑选一个受支持的 JDK。
const MIN_JDK = 17;
const MAX_JDK = 21;

function javaMajor(javaHome) {
  try {
    const release = fs.readFileSync(path.join(javaHome, "release"), "utf8");
    const match = release.match(/^JAVA_VERSION="?(\d+)/m);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

function isSupportedJdk(javaHome) {
  const major = javaMajor(javaHome);
  return major !== null && major >= MIN_JDK && major <= MAX_JDK;
}

function jdkCandidates() {
  const candidates = [];
  const push = (candidate) => {
    if (candidate && !candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  };
  if (process.platform === "darwin" && fs.existsSync("/usr/libexec/java_home")) {
    for (const version of ["21", "17"]) {
      try {
        push(
          execFileSync("/usr/libexec/java_home", ["-v", version], {
            encoding: "utf8",
          }).trim(),
        );
      } catch {
        // 未安装该版本时 java_home 会返回非零退出码。
      }
    }
  }
  const roots = [
    process.env.HOME
      ? path.join(process.env.HOME, "Library", "Java", "JavaVirtualMachines")
      : null,
    "/Library/Java/JavaVirtualMachines",
    "/usr/lib/jvm",
  ].filter(Boolean);
  for (const root of roots) {
    if (!fs.existsSync(root)) {
      continue;
    }
    for (const entry of fs.readdirSync(root).sort().reverse()) {
      push(path.join(root, entry, "Contents", "Home"));
      push(path.join(root, entry));
    }
  }
  return candidates;
}

function applyJavaHome(targetEnv) {
  if (targetEnv.JAVA_HOME && isSupportedJdk(targetEnv.JAVA_HOME)) {
    return;
  }
  const resolved = jdkCandidates().find(isSupportedJdk);
  if (!resolved) {
    console.warn(
      `[ainote] 未找到 JDK ${MIN_JDK}-${MAX_JDK}：当前 Gradle/AGP/Kotlin 版本矩阵无法在更高版本 JDK 上运行，请安装后重试。`,
    );
    return;
  }
  if (targetEnv.JAVA_HOME) {
    console.warn(`[ainote] 忽略不兼容的 JAVA_HOME=${targetEnv.JAVA_HOME}，改用 ${resolved}`);
  } else {
    console.log(`[ainote] 使用 JDK ${javaMajor(resolved)}: ${resolved}`);
  }
  targetEnv.JAVA_HOME = resolved;
}

function latestNdk(sdkDir) {
  const ndkDir = path.join(sdkDir, "ndk");
  if (!fs.existsSync(ndkDir)) {
    return null;
  }
  const versions = fs
    .readdirSync(ndkDir)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return versions.length > 0 ? path.join(ndkDir, versions.at(-1)) : null;
}

function findNdk() {
  const configured =
    process.env.ANDROID_NDK_HOME || process.env.NDK_HOME || process.env.ANDROID_NDK_ROOT;
  if (configured && fs.existsSync(configured)) {
    return configured;
  }
  const sdkDirs = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.HOME ? path.join(process.env.HOME, "Library", "Android", "sdk") : null,
  ];
  for (const sdkDir of sdkDirs) {
    if (!sdkDir) {
      continue;
    }
    const ndk = latestNdk(sdkDir);
    if (ndk) {
      return ndk;
    }
  }
  return null;
}

function applyNdkToolchain(targetEnv) {
  const ndk = findNdk();
  if (!ndk) {
    return;
  }
  const host = process.platform === "darwin" ? "darwin-x86_64" : "linux-x86_64";
  const bin = path.join(ndk, "toolchains", "llvm", "prebuilt", host, "bin");
  const ranlib = path.join(bin, "llvm-ranlib");
  const ar = path.join(bin, "llvm-ar");
  if (!fs.existsSync(ranlib)) {
    return;
  }
  const setDefault = (key, value) => {
    if (!targetEnv[key]) {
      targetEnv[key] = value;
    }
  };
  setDefault("RANLIB", ranlib);
  for (const target of [
    "aarch64_linux_android",
    "armv7_linux_androideabi",
    "i686_linux_android",
    "x86_64_linux_android",
  ]) {
    setDefault(`RANLIB_${target}`, ranlib);
    setDefault(`AR_${target}`, ar);
  }
}

function main() {
  if (process.platform === "win32") {
    console.error(
      "[ainote] Windows 暂不支持 Android 构建：需要 OPENSSL_SRC_PERL 包装脚本，见 docs/ARCHITECTURE.md §6。请在 macOS/Linux 或 CI 上构建。",
    );
    process.exit(1);
  }

  const env = { ...process.env };
  env.OPENSSL_SRC_PERL = path.join(here, "openssl-src-perl-wrapper.sh");
  applyJavaHome(env);
  applyNdkToolchain(env);

  const child = spawn("pnpm", ["exec", "tauri", "android", ...process.argv.slice(2)], {
    env,
    stdio: "inherit",
  });
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
