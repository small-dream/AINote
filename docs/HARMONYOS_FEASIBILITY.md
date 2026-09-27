# AINote 鸿蒙版可行性评估

> 类型：决策评估（非活文档）· 状态：待评审 · 日期：2026-09-27
> 结论若被采纳，需同步更新 `PRD.md`、`ROADMAP.md`、`ARCHITECTURE.md`、`CODING_STANDARDS.md` 与 `AGENTS.md` 的跨端铁律。

## 1. 结论摘要

**技术可行，但不是「加一个 target」的量级，而是一次新的移动端落地。**

- 前端（React 19 + Vite 产物）可 100% 复用：鸿蒙 `ArkWeb` 是 Chromium 内核，本项目没有依赖浏览器之外的运行时能力。
- Rust 业务内核高度可复用：21,866 行 Rust 中只有 5,239 行（24%）引用 `tauri`；`domain`（3,435 行）与 `repositories`（5,978 行）**零** `tauri` 依赖，`services` 仅 7/41 文件（1,186/7,402 行）引用。
- 真正的成本在三处：**Tauri 运行时无官方鸿蒙支持**、**6 个 Tauri 插件零鸿蒙实现**、**libgit2/OpenSSL 交叉编译与 CA 信任链需重做一遍**。
- 底层工具链已具备：Rust `aarch64-unknown-linux-ohos` 是 **Tier 2 with Host Tools**（有官方预编译 std），`openssl-src` 已内置 OHOS 目标映射。

**推荐路线**：自建 ArkTS 壳（ArkWeb 承载现有前端）+ 把 Rust 内核做成 NAPI 原生模块，即「路线 B」。
**工期估算**：约 13–22 人周（单人 3–5 个月；两人并行约 2–3 个月），不含市场审核与外部等待，不确定性偏高。

**前置判断（必答）**：如果目标只是覆盖存量鸿蒙手机（HarmonyOS 4.x 及以下），**直接分发现有 Android 包即可，成本接近 0**，无需本项目。只有要覆盖 HarmonyOS NEXT（5.x，纯血鸿蒙，不再运行 APK）才需要下面的工作。

## 2. 目标平台辨析

| 平台 | 能否运行现有 Android 包 | 结论 |
|---|---|---|
| HarmonyOS 4.x 及以下（含 AOSP 兼容层） | 可以 | 复用现有 Android 构建产物即可，零开发成本 |
| HarmonyOS NEXT 5.x（纯血鸿蒙） | 不可以，`.hap` 与 ArkTS 生态 | 本评估的对象，必须专版开发 |

两者是**互斥的增量市场**：NEXT 是新出货设备的主线，且不支持侧载安装，长期只能靠华为应用市场分发。

## 3. 现状盘点：可复用面与耦合面

### 3.1 可直接复用（平台中立）

- `src/`（前端）：`features/` 25,377 行、`api/` 1,260 行、`stores/`、`hooks/`、`components/` 全部平台中立；`invoke()` 唯一出口在 `src/api/client.ts`，IPC 边界干净（ESLint 已强制）。
- `src-tauri/src/domain/`、`repositories/`：3,435 + 5,978 行，无 `tauri` 引用，原样交叉编译即可复用。
- `src-tauri/src/services/`：7,402 行中 6,216 行不依赖 `tauri`（Git、AI、hosting、索引、wiki 等）。
- 现有 e2e IPC mock（`src/e2e/` + `?e2e`）可作为鸿蒙壳开发期的对端替身，先跑通 UI 再接原生层。

### 3.2 必须重做或替换（平台耦合）

| 耦合点 | 规模 | 鸿蒙侧替代 |
|---|---|---|
| `tauri::Builder/AppHandle/State/Event/Window` | 5,239 行（87/98 个 command 文件） | 自建 IPC 分发层（命令表 + 序列化），或等上游 |
| `commands/` 适配层 | 2,795 行 | 保留 `Result<T, AppErrorDto>` 契约，仅换壳 |
| `platform/`（托盘、JNI 桥、quick_unlock） | 1,107 行 | 全新 ArkTS/NAPI 实现 |
| 插件：dialog / notification / process / updater / window-state / keyring-store | 6 个 | 需逐个写鸿蒙实现（HarmonyOS API：选择器、通知、分享、HUKS 等） |
| `repositories/ca_bundle.rs` | Android 专属 | 需为 OHOS 系统 CA 路径重做 |
| `src/platform/*.ts` 平台判定 | 381 行 | 新增 `isHarmonyApp()`（ArkWeb UA），并接入 `ShellSwitcher` 移动壳 |
| Tauri updater + GitHub Releases 自更新 | — | 鸿蒙统一走应用市场分发，自更新模型预期不可用 |

## 4. 关键技术事实核验（2026-09-27）

1. **Rust 工具链已就绪**：`aarch64-unknown-linux-ohos` / `armv7-*` / `x86_64-*` 在 Rust 官方平台支持表中为 **Tier 2 with Host Tools**；本机 `rustup target list` 提供该 target，`rustup target add` 已在下载 `rust-std` 组件（即官方分发预编译 std，无需 nightly `build-std`）。`loongarch64-*` 仍为 Tier 3。
2. **OpenSSL 交叉编译无阻塞**：`openssl-src` 源码中已内置映射 `aarch64-unknown-linux-ohos → linux-aarch64`、`armv7-* → linux-generic32`、`x86_64-* → linux-x86_64`，本项目 `git2` 的 `vendored-openssl` 路线在 OHOS 可延续。
3. **Tauri 官方仍未支持鸿蒙**：已发布的 `tauri 2.12.0` 与 `tauri 3.0.0-alpha.3` 均无 OHOS 代码（`dev` 分支全树 0 个 ohos/harmony 文件）。仅有实验分支 `feat/open-harmony`（最后提交 2026-07-30，领先 dev 40 / 落后 164，**无对应合并 PR**），其中包含 `crates/tauri/src/ohos.rs` 与 CLI 的 `cargo tauri ohos init`。
4. **wry 侧已跑通 ArkWeb 接法**（`feat/open-harmony` 分支已合入 OHOS 支持，PR #1607 / 2026-06-08）：基于 ArkWeb 的 `WebViewBuilder` + JS proxy `postMessage` 实现 IPC，并支持自定义协议异步回调。**这证明「ArkWeb 装载现有 React 产物 + 自定义协议/IPC」技术成立**。
5. **但上游依赖链很早期**：该分支要求 `openharmony-ability`（`harmony-contrib` 组织，14 stars，以 **git 依赖**方式引入）与 `@ohos-rs/ability`（OHPM 包，`0.4.0-beta.0`）；CLI 还需要带 `open_harmony` 模块的 `cargo-mobile2`，而 crates.io 最新 `0.22.5` **没有**该模块（docs.rs 404），意味着要走分支就得 fork/build 整条 CLI。
6. **Tauri 插件生态零鸿蒙支持**：`tauri-apps/plugins-workspace` v2 分支全树 0 个 ohos 文件；`tauri-plugin-keyring-store` 为个人小体量插件（1 star），亦无鸿蒙实现。

## 5. 路线对比

| | A. 跟随上游 Tauri OHOS 分支 | B. 自建 ArkTS 壳 + NAPI Rust 内核（推荐） | C. ArkTS 全重写 |
|---|---|---|---|
| 前端复用 | 100% | 100% | 0% |
| Rust 业务复用 | ~76% | ~76% | 0% |
| 技术风险 | 高（维护未合并分支 + fork CLI/wry/cargo-mobile2） | 中（核心是自建 IPC 与平台能力） | 低（无跨栈风险但工作量最大） |
| 上游绑定 | 极强，需持续追搬 164+ 提交的差异 | 弱，只依赖 Rust 标准库/OHOS NDK | 无 |
| 插件 | 仍需自行补齐（上游没有） | 需自行实现（预期工作量相同） | 原生实现 |
| 综合成本 | 中高且不可控 | **中** | 高 |

**推荐 B**：A 的唯一优势是能复用 wry/tauri 的 OHOS 后端代码，但该后端本身仍未合并、依赖 git 版本、且插件层一样要自己写；把命脉挂在未合并分支上，长期维护成本高于自己写一层薄壳。B 的 IPC 层规模可控（本项目命令契约已经很整齐），且 `domain`/`repositories`/`services` 的零污染设计让复用率真实可落地。

## 6. 推荐路线的工作分解

### 阶段 0：工具链与冒险验证（2–3 人周，决策门）

- 安装并固化 DevEco Studio / OHOS SDK / NDK / `ohpm` / `hvigor` / `hdc`；确认 CI（GitHub Actions Linux runner）能否构建 `.hap`，否则需 macOS runner。
- `cargo build --target aarch64-unknown-linux-ohos` 编译 `domain` + `repositories`（先不带 `tauri`）。
- 攻克 `git2`（libgit2 + vendored OpenSSL + libssh2）交叉编译：提供 OHOS clang/sysroot 的 `CC/AR`；重点排查 Android 上遇到过的 `no-stdio` 同类坑（本项目已有 `scripts/openssl-src-perl-wrapper.sh` 经验可迁移）。
- 原生壳最小闭环：ArkWeb 装载 `dist/`，`Web` + `javaScriptProxy` 打通一条 IPC 命令（如 `app_version`）并读写沙盒文件。

**决策门**：以上四项任一失败且无替代方案，则暂停并重新评估。

### 阶段 1：IPC 壳与平台层（3–5 人周）

- ArkTS 侧：`EntryAbility` + `Web` 组件 + NAPI 模块（`libentry.so`）。
- Rust 侧：新增 `src-tauri/src/platform/harmony/`（对应现有 `android_bridge.rs` 的位置），实现 IPC 命令表分发，保持 `Result<T, AppErrorDto>` 契约不变，错误码沿用 `<域>_<序号>`。
- 沙盒路径注入：把 `app_data_dir`/`app_config_dir` 映射到 `context.filesDir`/`cacheDir`，复用 `app_data_dir/notes/` 的仓库布局。
- 日志接 `hilog`；权限（`ohos.permission.INTERNET`、文件读写）写入 `module.json5`。

### 阶段 2：平台能力替换（3–5 人周）

- 安全存储：实现 `SecureStore` 的鸿蒙实现（HUKS / Preferences），替换 `tauri-plugin-keyring-store`；Token/AI Key 依旧不进前端（安全红线不变）。
- 通知（`@ohos.notificationManager`）、分享/导出、文件选择（`@ohos.file.picker` → 复用 `import_asset_bytes` 链路）。
- 生命周期与返回键：对齐 `MOBILE_PLAN.md` 阶段 3 的 flush 策略（`visibilitychange`/`pagehide`/返回动作）。
- CA 信任链：为 OHOS 系统 CA 路径补 `ca_bundle` 等价实现，证书链校验保持开启（不复制 Android 的放行逻辑）。
- 设备级快速解锁（可选）：`platform/quick_unlock/` 新增 OHOS 后端（HUKS + 生物识别），或在首版明确返回「不支持」。

### 阶段 3：移动壳适配与真机打磨（3–5 人周）

- `src/platform/runtime.ts` 新增 `isHarmonyApp()`（ArkWeb UA 判定），`ShellSwitcher` 复用移动单栏壳；桌面壳不得引入鸿蒙分支。
- safe-area、软键盘避让、输入法/选区/滚动（CodeMirror 6 + TipTap）真机验证。
- 性能门禁对齐 `MOBILE_PLAN.md` §9.3（冷启动可编辑 ≤ 2s、千篇列表 100ms 级）。

### 阶段 4：签名、上架与合规（2–4 人周 + 外部等待）

- 华为开发者账号、应用签名、`.hap` 打包；中国区要求的 App 备案与市场审核。
- 明确「无自更新」的分发与升级策略，更新 UI（`features/update`）在鸿蒙分支需给出对应文案。

## 7. 风险清单

| 风险 | 等级 | 应对 |
|---|---|---|
| Tauri 无官方鸿蒙支持，生态处于实验期 | 高 | 选路线 B；只依赖 Rust 标准库 + OHOS NDK，不追未合并分支 |
| libgit2/OpenSSL/libssh2 交叉编译失败 | 高 | 阶段 0 先验证；沿用 Android 的 `openssl-src` 包装脚本经验 |
| 6 个插件需全部重写 | 中高 | 按 `SecureStore` 抽象替换；updater 直接改为市场分发 |
| CA 信任链重做（Android 已有前车之鉴） | 中 | 复用 `ca_bundle` 思路，仅换系统路径与兼容性处理 |
| 应用市场对 Web 壳应用的审核口径 | 中 | 提交前核实审核规范；必要时把关键路径做原生增强 |
| 自动更新模型不适用 | 中 | 产品侧接受「随市场升级」，移除自更新承诺 |
| CI 工具链（DevEco/hvigor）可用性 | 中 | 阶段 0 确认；不可行则接受 macOS runner 或本地出包 |
| 三端维护成本（桌面 / iOS+Android / 鸿蒙） | 中高 | 守住「平台差异只进 `src/platform/` 与 `src-tauri/src/platform/`」，禁止业务层分叉 |
| ohos-rs / openharmony-ability 生态早期 | 中 | 尽量只用 NAPI 标准面，避免深绑单一框架 |

## 8. 验收门禁（若立项）

- 沿用 `MOBILE_PLAN.md` §11 的完成定义，鸿蒙端对齐：Release `.hap` 可安装启动、GitHub 授权/clone/离线编辑/commit/前台同步闭环、Token 不进前端与日志、暂停恢复/软键盘/返回键无异常。
- 跨端铁律扩维：`AGENTS.md` 与 `CODING_STANDARDS.md` §5.2 的 `Desktop Impact` / `Mobile Impact` 需增加 `Harmony Impact`；`shared` 改动要求三端各验证一次。
- 现有 `pnpm build && pnpm test && pnpm lint`、`cargo test` 不得回归。

## 9. 待人工确认的开放问题

1. 目标平台是否确为 HarmonyOS NEXT（5.x）？若只覆盖 4.x，直接发布 Android 包。
2. 是否接受「无自更新、纯应用市场分发」？
3. 是否有华为开发者账号与上架/备案资源（此项为硬前置，非技术问题）。
4. CI 采用 GitHub Actions macOS runner 还是本地/自建出包？
5. 首版是否包含设备级快速解锁、AI、回收站等 P1/P2 能力，还是先做编辑 + Git 闭环。
